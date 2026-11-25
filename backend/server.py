import asyncio
import hashlib
import hmac
import logging
import math
import os
import random
import uuid
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

import httpx
import razorpay
import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel, ReturnDocument
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

try:  # launched as `backend.server` (the default)
    from backend.clerk_auth import clerk_router, require_user
except ModuleNotFoundError:  # launched from inside backend/ as `server`
    from clerk_auth import clerk_router, require_user

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
              IndexModel([("role", ASCENDING)], name="role")],
    "drivers": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
                IndexModel([("status", ASCENDING), ("online", ASCENDING)], name="status_online")],
    "fares": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
    "bookings": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                 IndexModel([("customer_id", ASCENDING), ("created_at", DESCENDING)], name="customer"),
                 IndexModel([("driver_id", ASCENDING), ("created_at", DESCENDING)], name="driver"),
                 IndexModel([("status", ASCENDING), ("vehicle", ASCENDING)], name="status_vehicle"),
                 IndexModel([("created_at", DESCENDING)], name="created_desc")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI()
api = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Roles ----------
ROLES = ["admin", "driver", "customer"]
DEFAULT_ROLE = "customer"
RETIRED_ROLES: dict = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}
ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"
IN_ENV = {"env": {"$in": [ENV, None]}}
COMMISSION = 0.20


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


def _clerk_user(user_id: str) -> dict:
    r = requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
                     headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "emergent-app"})
    r.raise_for_status()
    return r.json()


def _profile_from_clerk(cu: dict) -> tuple[dict, bool]:
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    emails = cu.get("email_addresses") or []
    is_admin = any(e["email_address"].lower() in admins and (e.get("verification") or {}).get("status") == "verified"
                   for e in emails)
    primary = next((e["email_address"] for e in emails if e["id"] == cu.get("primary_email_address_id")),
                   emails[0]["email_address"] if emails else "")
    name = " ".join(x for x in [cu.get("first_name"), cu.get("last_name")] if x) or primary.split("@")[0]
    return {"email": primary, "name": name}, is_admin


async def current_member(user: dict = Depends(require_user)) -> dict:
    uid = user["user_id"]
    member = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if member is None or not member.get("role"):
        cu = await run_in_threadpool(_clerk_user, uid)
        profile, is_admin = _profile_from_clerk(cu)
        role = "admin" if is_admin else DEFAULT_ROLE
        await db.users.update_one({"user_id": uid, "role": {"$in": [None, ""]}}, {"$set": {"role": role}})
        member = await db.users.find_one_and_update(
            {"user_id": uid},
            {"$setOnInsert": {"user_id": uid, "role": role, "phone": "", "created_at": now_iso(), **profile}},
            upsert=True, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if member.get("env") != ENV:
        await db.users.update_one({"user_id": uid}, {"$set": {"env": ENV}})
    return {**member, "env": ENV, "role": effective_role(member["role"])}


def require_role(*roles: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return member
    return check


# ---------- Fares ----------
DEFAULT_FARES = [
    {"key": "bike", "label": "Bike", "service": "ride", "vehicle": "bike", "capacity": 1, "base": 20, "per_km": 7, "per_min": 1, "min_fare": 30, "per_hour": 0, "speed": 28},
    {"key": "erickshaw", "label": "E-Rickshaw", "service": "ride", "vehicle": "erickshaw", "capacity": 4, "base": 25, "per_km": 9, "per_min": 1, "min_fare": 35, "per_hour": 0, "speed": 15},
    {"key": "car_mini", "label": "Cab Mini", "service": "ride", "vehicle": "car", "capacity": 4, "base": 50, "per_km": 12, "per_min": 1.5, "min_fare": 90, "per_hour": 0, "speed": 24},
    {"key": "car_sedan", "label": "Cab Sedan", "service": "ride", "vehicle": "car", "capacity": 4, "base": 60, "per_km": 14, "per_min": 1.8, "min_fare": 110, "per_hour": 0, "speed": 24},
    {"key": "car_suv", "label": "Cab XL (SUV)", "service": "ride", "vehicle": "car", "capacity": 6, "base": 80, "per_km": 18, "per_min": 2, "min_fare": 150, "per_hour": 0, "speed": 24},
    {"key": "parcel_bike", "label": "Parcel by Bike", "service": "parcel", "vehicle": "bike", "capacity": 0, "base": 30, "per_km": 8, "per_min": 0.5, "min_fare": 45, "per_hour": 0, "speed": 28},
    {"key": "parcel_van", "label": "Parcel by Mini Van", "service": "parcel", "vehicle": "van", "capacity": 0, "base": 150, "per_km": 22, "per_min": 1, "min_fare": 250, "per_hour": 0, "speed": 20},
    {"key": "rental_bike", "label": "Bike Rental", "service": "rental", "vehicle": "bike", "capacity": 1, "base": 0, "per_km": 0, "per_min": 0, "min_fare": 99, "per_hour": 99, "speed": 28},
    {"key": "rental_car", "label": "Cab Rental", "service": "rental", "vehicle": "car", "capacity": 4, "base": 0, "per_km": 0, "per_min": 0, "min_fare": 299, "per_hour": 299, "speed": 24},
]
VEHICLES = ["bike", "erickshaw", "car", "van"]


async def seed_fares():
    for f in DEFAULT_FARES:
        await db.fares.update_one({"key": f["key"]}, {"$setOnInsert": {**f, "active": True}}, upsert=True)


class Place(BaseModel):
    address: str = Field(min_length=2, max_length=300)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


def haversine_km(a: Place, b: Place) -> float:
    r = 6371.0
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dp, dl = p2 - p1, math.radians(b.lon - a.lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def quote(fare: dict, km: float, hours: int) -> dict:
    if fare["service"] == "rental":
        amount = max(fare["min_fare"], fare["per_hour"] * hours)
        return {"fare": int(round(amount)), "distance_km": 0, "duration_min": hours * 60}
    minutes = km / max(fare.get("speed") or 20, 5) * 60
    amount = max(fare["min_fare"], fare["base"] + fare["per_km"] * km + fare["per_min"] * minutes)
    return {"fare": int(round(amount)), "distance_km": round(km, 1), "duration_min": int(round(minutes))}


@api.get("/fares")
async def list_fares(member: dict = Depends(current_member)):
    return await db.fares.find({}, {"_id": 0}).to_list(100)


class FareUpdate(BaseModel):
    base: float = Field(ge=0)
    per_km: float = Field(ge=0)
    per_min: float = Field(ge=0)
    min_fare: float = Field(ge=0)
    per_hour: float = Field(ge=0)
    active: bool


@api.put("/admin/fares/{key}")
async def update_fare(key: str, body: FareUpdate, admin: dict = Depends(require_role("admin"))):
    doc = await db.fares.find_one_and_update({"key": key}, {"$set": body.model_dump()},
                                             projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


# ---------- Geo (OpenStreetMap) ----------
NOMINATIM = "https://nominatim.openstreetmap.org"
GEO_HEADERS = {"User-Agent": "SafarMobilityApp/1.0 (ride booking)", "Accept-Language": "en"}
_geo_cache: dict = {}


async def _geo(path: str, params: dict):
    ck = path + str(sorted(params.items()))
    if ck in _geo_cache:
        return _geo_cache[ck]
    try:
        async with httpx.AsyncClient(timeout=8) as hc:
            r = await hc.get(f"{NOMINATIM}/{path}", params={**params, "format": "jsonv2"}, headers=GEO_HEADERS)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError:
        raise HTTPException(502, "Location search is unavailable right now")
    if len(_geo_cache) > 2000:
        _geo_cache.clear()
    _geo_cache[ck] = data
    return data


@api.get("/geo/search")
async def geo_search(q: str = Query(min_length=3, max_length=120), member: dict = Depends(current_member)):
    data = await _geo("search", {"q": q, "countrycodes": "in", "limit": 6, "addressdetails": 0})
    return [{"address": d["display_name"], "lat": float(d["lat"]), "lon": float(d["lon"])} for d in data]


@api.get("/geo/reverse")
async def geo_reverse(lat: float, lon: float, member: dict = Depends(current_member)):
    d = await _geo("reverse", {"lat": round(lat, 5), "lon": round(lon, 5), "zoom": 17})
    return {"address": d.get("display_name") or f"{lat:.5f}, {lon:.5f}", "lat": lat, "lon": lon}


# ---------- Profile ----------
class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: str = Field(default="", max_length=15)


async def driver_profile(uid: str):
    return await db.drivers.find_one({"user_id": uid}, {"_id": 0})


@api.get("/me")
async def me(member: dict = Depends(current_member)):
    return {**member, "driver": await driver_profile(member["user_id"])}


@api.put("/me")
async def update_me(body: ProfileIn, member: dict = Depends(current_member)):
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": body.model_dump()})
    return {**member, **body.model_dump()}


# ---------- Bookings ----------
Service = Literal["ride", "parcel", "rental"]
ACTIVE = ["searching", "accepted", "arrived", "ongoing"]


class EstimateIn(BaseModel):
    service: Service
    pickup: Place
    drop: Optional[Place] = None
    hours: int = Field(default=2, ge=1, le=12)


class ParcelInfo(BaseModel):
    receiver_name: str = Field(min_length=1, max_length=80)
    receiver_phone: str = Field(min_length=10, max_length=15)
    item: str = Field(min_length=1, max_length=120)
    weight_kg: float = Field(default=1, gt=0, le=500)


class BookingIn(EstimateIn):
    fare_key: str
    payment_method: Literal["cash", "online"]
    parcel: Optional[ParcelInfo] = None


def _km(body: EstimateIn) -> float:
    if body.service == "rental":
        return 0.0
    if not body.drop:
        raise HTTPException(422, "Drop location is required")
    km = haversine_km(body.pickup, body.drop) * 1.3
    if km > 300:
        raise HTTPException(422, "Trips longer than 300 km are not supported")
    return max(km, 0.5)


@api.post("/bookings/estimate")
async def estimate(body: EstimateIn, member: dict = Depends(current_member)):
    km = _km(body)
    fares = await db.fares.find({"service": body.service, "active": True}, {"_id": 0}).to_list(50)
    out = []
    for f in fares:
        online = await db.drivers.count_documents({"status": "approved", "online": True, "vehicle_type": f["vehicle"]})
        out.append({"fare_key": f["key"], "label": f["label"], "vehicle": f["vehicle"], "capacity": f["capacity"],
                    "drivers_online": online, **quote(f, km, body.hours)})
    return out


def payments_enabled() -> bool:
    return bool(os.environ.get("RAZORPAY_KEY_ID") and os.environ.get("RAZORPAY_KEY_SECRET"))


def view_booking(b: dict, viewer: dict) -> dict:
    b = dict(b)
    b.pop("razorpay_order_id", None)
    if viewer["role"] != "admin" and viewer["user_id"] != b["customer_id"]:
        b.pop("otp", None)
    return b


@api.post("/bookings")
async def create_booking(body: BookingIn, member: dict = Depends(current_member)):
    await expire_stale()
    if await db.bookings.find_one({"customer_id": member["user_id"], "status": {"$in": ACTIVE}}, {"_id": 0, "id": 1}):
        raise HTTPException(409, "You already have an active booking")
    fare = await db.fares.find_one({"key": body.fare_key, "service": body.service, "active": True}, {"_id": 0})
    if not fare:
        raise HTTPException(422, "This vehicle option is not available")
    if body.payment_method == "online" and not payments_enabled():
        raise HTTPException(422, "Online payment is not available yet. Please choose cash.")
    if body.service == "parcel" and not body.parcel:
        raise HTTPException(422, "Receiver details are required for parcels")
    q = quote(fare, _km(body), body.hours)
    doc = {
        "id": str(uuid.uuid4()), "code": "SF" + str(random.randint(100000, 999999)),
        "customer_id": member["user_id"], "customer_name": member.get("name", ""), "customer_phone": member.get("phone", ""),
        "service": body.service, "fare_key": fare["key"], "vehicle_label": fare["label"], "vehicle": fare["vehicle"],
        "pickup": body.pickup.model_dump(), "drop": body.drop.model_dump() if body.drop and body.service != "rental" else None,
        "hours": body.hours if body.service == "rental" else None,
        "parcel": body.parcel.model_dump() if body.service == "parcel" else None,
        **q, "payment_method": body.payment_method, "payment_status": "pending",
        "status": "searching", "otp": f"{random.randint(0, 9999):04d}",
        "driver_id": None, "driver": None, "rating": None, "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    return view_booking(doc, member)


async def expire_stale():
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    await db.bookings.update_many({"status": "searching", "created_at": {"$lt": cutoff}},
                                  {"$set": {"status": "cancelled", "cancelled_by": "system",
                                            "cancel_reason": "No driver was available", "updated_at": now_iso()}})


@api.get("/bookings")
async def my_bookings(member: dict = Depends(current_member)):
    rows = await db.bookings.find({"customer_id": member["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [view_booking(b, member) for b in rows]


@api.get("/bookings/active")
async def my_active_booking(member: dict = Depends(current_member)):
    await expire_stale()
    b = await db.bookings.find_one({"customer_id": member["user_id"], "status": {"$in": ACTIVE}}, {"_id": 0})
    return view_booking(b, member) if b else None


@api.get("/bookings/{bid}")
async def get_booking(bid: str, member: dict = Depends(current_member)):
    await expire_stale()
    scope = {}
    if member["role"] != "admin":
        scope = {"$or": [{"customer_id": member["user_id"]}, {"driver_id": member["user_id"]}]}
    b = await db.bookings.find_one({"id": bid, **scope}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    out = view_booking(b, member)
    if b.get("driver_id") and b["status"] in ACTIVE:
        d = await driver_profile(b["driver_id"])
        out["driver_location"] = d.get("location") if d else None
    return out


@api.post("/bookings/{bid}/cancel")
async def cancel_booking(bid: str, member: dict = Depends(current_member)):
    b = await db.bookings.find_one_and_update(
        {"id": bid, "customer_id": member["user_id"], "status": {"$in": ["searching", "accepted", "arrived"]}},
        {"$set": {"status": "cancelled", "cancelled_by": "customer", "updated_at": now_iso()}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not b:
        raise HTTPException(409, "This booking can no longer be cancelled")
    return view_booking(b, member)


class RateIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=300)


@api.post("/bookings/{bid}/rate")
async def rate_booking(bid: str, body: RateIn, member: dict = Depends(current_member)):
    b = await db.bookings.find_one_and_update(
        {"id": bid, "customer_id": member["user_id"], "status": "completed", "rating": None},
        {"$set": {"rating": body.rating, "rating_comment": body.comment}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not b:
        raise HTTPException(409, "This trip can't be rated")
    rated = await db.bookings.find({"driver_id": b["driver_id"], "rating": {"$ne": None}}, {"_id": 0, "rating": 1}).to_list(5000)
    avg = round(sum(r["rating"] for r in rated) / len(rated), 2)
    await db.drivers.update_one({"user_id": b["driver_id"]}, {"$set": {"rating": avg, "ratings_count": len(rated)}})
    return view_booking(b, member)


# ---------- Driver ----------
class DriverApply(BaseModel):
    vehicle_type: Literal["bike", "erickshaw", "car", "van"]
    vehicle_model: str = Field(min_length=2, max_length=60)
    vehicle_number: str = Field(min_length=4, max_length=15)
    license_number: str = Field(min_length=5, max_length=25)
    phone: str = Field(min_length=10, max_length=15)
    city: str = Field(min_length=2, max_length=60)


@api.post("/driver/apply")
async def driver_apply(body: DriverApply, member: dict = Depends(current_member)):
    existing = await driver_profile(member["user_id"])
    if existing and existing["status"] in ["pending", "approved"]:
        raise HTTPException(409, "You have already applied")
    data = {**body.model_dump(), "vehicle_number": body.vehicle_number.upper().replace(" ", "")}
    await db.drivers.update_one(
        {"user_id": member["user_id"]},
        {"$set": {**data, "status": "pending", "name": member.get("name", ""), "email": member.get("email", ""),
                  "applied_at": now_iso(), "env": ENV},
         "$setOnInsert": {"user_id": member["user_id"], "online": False, "rating": None, "ratings_count": 0, "location": None}},
        upsert=True)
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"phone": body.phone}})
    return await driver_profile(member["user_id"])


async def current_driver(member: dict = Depends(require_role("driver"))) -> dict:
    d = await driver_profile(member["user_id"])
    if not d or d["status"] != "approved":
        raise HTTPException(403, "Your driver account is not approved yet")
    return {**member, "driver": d}


class OnlineIn(BaseModel):
    online: bool


@api.post("/driver/status")
async def driver_status(body: OnlineIn, drv: dict = Depends(current_driver)):
    await db.drivers.update_one({"user_id": drv["user_id"]}, {"$set": {"online": body.online}})
    return await driver_profile(drv["user_id"])


class LocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


@api.post("/driver/location")
async def driver_location(body: LocationIn, drv: dict = Depends(current_driver)):
    await db.drivers.update_one({"user_id": drv["user_id"]},
                                {"$set": {"location": {**body.model_dump(), "at": now_iso()}}})
    return {"ok": True}


@api.get("/driver/requests")
async def driver_requests(drv: dict = Depends(current_driver)):
    d = drv["driver"]
    if not d.get("online"):
        return []
    await expire_stale()
    rows = await db.bookings.find({"status": "searching", "vehicle": d["vehicle_type"]},
                                  {"_id": 0, "otp": 0, "razorpay_order_id": 0}).sort("created_at", -1).to_list(50)
    loc = d.get("location")
    for r in rows:
        if loc:
            r["pickup_km"] = round(haversine_km(Place(address="x" * 2, **{k: loc[k] for k in ("lat", "lon")}),
                                                Place(**r["pickup"])), 1)
    if loc:
        rows.sort(key=lambda r: r.get("pickup_km", 9999))
    return rows


@api.get("/driver/active")
async def driver_active(drv: dict = Depends(current_driver)):
    b = await db.bookings.find_one({"driver_id": drv["user_id"], "status": {"$in": ACTIVE}}, {"_id": 0})
    return view_booking(b, drv) if b else None


@api.post("/driver/bookings/{bid}/accept")
async def driver_accept(bid: str, drv: dict = Depends(current_driver)):
    d = drv["driver"]
    if await db.bookings.find_one({"driver_id": drv["user_id"], "status": {"$in": ACTIVE}}, {"_id": 0, "id": 1}):
        raise HTTPException(409, "Finish your current trip first")
    info = {"name": d.get("name") or drv.get("name", ""), "phone": d.get("phone", ""), "vehicle_model": d["vehicle_model"],
            "vehicle_number": d["vehicle_number"], "rating": d.get("rating")}
    b = await db.bookings.find_one_and_update(
        {"id": bid, "status": "searching", "vehicle": d["vehicle_type"]},
        {"$set": {"status": "accepted", "driver_id": drv["user_id"], "driver": info, "accepted_at": now_iso(), "updated_at": now_iso()}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not b:
        raise HTTPException(409, "This request was taken or cancelled")
    return view_booking(b, drv)


async def _driver_transition(bid: str, uid: str, frm: list, update: dict):
    b = await db.bookings.find_one_and_update({"id": bid, "driver_id": uid, "status": {"$in": frm}},
                                              {"$set": {**update, "updated_at": now_iso()}},
                                              projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not b:
        raise HTTPException(409, "This action is not possible right now")
    return b


@api.post("/driver/bookings/{bid}/arrived")
async def driver_arrived(bid: str, drv: dict = Depends(current_driver)):
    return view_booking(await _driver_transition(bid, drv["user_id"], ["accepted"], {"status": "arrived", "arrived_at": now_iso()}), drv)


class OtpIn(BaseModel):
    otp: str = Field(min_length=4, max_length=4)


@api.post("/driver/bookings/{bid}/start")
async def driver_start(bid: str, body: OtpIn, drv: dict = Depends(current_driver)):
    b = await db.bookings.find_one({"id": bid, "driver_id": drv["user_id"], "status": {"$in": ["accepted", "arrived"]}}, {"_id": 0})
    if not b:
        raise HTTPException(409, "This action is not possible right now")
    if b.get("otp_attempts", 0) >= 5:
        raise HTTPException(429, "Too many wrong OTP attempts. Release this trip or ask the customer to rebook.")
    if not hmac.compare_digest(b["otp"], body.otp):
        await db.bookings.update_one({"id": bid}, {"$inc": {"otp_attempts": 1}})
        raise HTTPException(400, f"Incorrect OTP ({4 - b.get('otp_attempts', 0)} attempts left)")
    return view_booking(await _driver_transition(bid, drv["user_id"], ["accepted", "arrived"],
                                                 {"status": "ongoing", "started_at": now_iso()}), drv)


@api.post("/driver/bookings/{bid}/release")
async def driver_release(bid: str, drv: dict = Depends(current_driver)):
    b = await _driver_transition(bid, drv["user_id"], ["accepted", "arrived"],
                                 {"status": "searching", "driver_id": None, "driver": None, "otp_attempts": 0,
                                  "otp": f"{random.randint(0, 9999):04d}", "created_at": now_iso()})
    await db.bookings.update_one({"id": bid}, {"$push": {"released_by": drv["user_id"]}})
    return {"id": b["id"], "status": b["status"]}


@api.post("/driver/bookings/{bid}/complete")
async def driver_complete(bid: str, drv: dict = Depends(current_driver)):
    b = await db.bookings.find_one({"id": bid, "driver_id": drv["user_id"], "status": "ongoing"}, {"_id": 0})
    if not b:
        raise HTTPException(409, "This action is not possible right now")
    upd = {"status": "completed", "completed_at": now_iso(), "driver_earning": int(round(b["fare"] * (1 - COMMISSION)))}
    if b["payment_method"] == "cash":
        upd["payment_status"] = "paid"
    return view_booking(await _driver_transition(bid, drv["user_id"], ["ongoing"], upd), drv)


@api.get("/driver/trips")
async def driver_trips(drv: dict = Depends(current_driver)):
    rows = await db.bookings.find({"driver_id": drv["user_id"]}, {"_id": 0, "otp": 0, "razorpay_order_id": 0}).sort("created_at", -1).to_list(300)
    today = datetime.now(timezone.utc).date().isoformat()
    done = [r for r in rows if r["status"] == "completed"]
    return {"trips": rows, "summary": {
        "completed": len(done),
        "earnings_total": sum(r.get("driver_earning", 0) for r in done),
        "earnings_today": sum(r.get("driver_earning", 0) for r in done if (r.get("completed_at") or "")[:10] == today),
        "trips_today": len([r for r in done if (r.get("completed_at") or "")[:10] == today]),
    }}


# ---------- Payments (Razorpay) ----------
def rzp():
    return razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))


@api.get("/payments/config")
async def payments_config(member: dict = Depends(current_member)):
    return {"enabled": payments_enabled(), "key_id": os.environ.get("RAZORPAY_KEY_ID", "") if payments_enabled() else ""}


class PayOrderIn(BaseModel):
    booking_id: str


@api.post("/payments/order")
async def payment_order(body: PayOrderIn, member: dict = Depends(current_member)):
    if not payments_enabled():
        raise HTTPException(422, "Online payment is not available")
    b = await db.bookings.find_one({"id": body.booking_id, "customer_id": member["user_id"], "payment_method": "online",
                                    "payment_status": "pending", "status": "completed"}, {"_id": 0})
    if not b:
        raise HTTPException(409, "Nothing to pay for this booking")
    try:
        order = await run_in_threadpool(rzp().order.create, {"amount": b["fare"] * 100, "currency": "INR",
                                                              "receipt": b["code"], "payment_capture": 1})
    except Exception as exc:
        logger.error("razorpay order: %s", exc)
        raise HTTPException(502, "Payment gateway error. Please try again.")
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"razorpay_order_id": order["id"]}})
    return {"order_id": order["id"], "amount": order["amount"], "currency": "INR", "key_id": os.environ["RAZORPAY_KEY_ID"],
            "name": member.get("name", ""), "email": member.get("email", ""), "contact": member.get("phone", "")}


class PayVerifyIn(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api.post("/payments/verify")
async def payment_verify(body: PayVerifyIn, member: dict = Depends(current_member)):
    b = await db.bookings.find_one({"id": body.booking_id, "customer_id": member["user_id"]}, {"_id": 0})
    if not b or b.get("razorpay_order_id") != body.razorpay_order_id:
        raise HTTPException(404, "Not found")
    expected = hmac.new(os.environ["RAZORPAY_KEY_SECRET"].encode(),
                        f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(400, "Payment verification failed")
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"payment_status": "paid", "razorpay_payment_id": body.razorpay_payment_id,
                                                            "paid_at": now_iso()}})
    return {"ok": True}


# ---------- Admin ----------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_role("admin"))):
    rows = await db.bookings.find({}, {"_id": 0, "status": 1, "fare": 1, "service": 1, "created_at": 1, "payment_status": 1}).to_list(20000)
    done = [r for r in rows if r["status"] == "completed"]
    days = [(datetime.now(timezone.utc).date() - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]
    return {
        "bookings_total": len(rows),
        "bookings_active": len([r for r in rows if r["status"] in ACTIVE]),
        "bookings_completed": len(done),
        "bookings_cancelled": len([r for r in rows if r["status"] == "cancelled"]),
        "gross_revenue": sum(r["fare"] for r in done),
        "platform_earnings": int(round(sum(r["fare"] for r in done) * COMMISSION)),
        "customers": await db.users.count_documents({"role": "customer", **IN_ENV}),
        "drivers_approved": await db.drivers.count_documents({"status": "approved"}),
        "drivers_pending": await db.drivers.count_documents({"status": "pending"}),
        "drivers_online": await db.drivers.count_documents({"status": "approved", "online": True}),
        "by_service": {s: len([r for r in rows if r["service"] == s]) for s in ["ride", "parcel", "rental"]},
        "daily": [{"day": d[5:], "bookings": len([r for r in rows if r["created_at"][:10] == d]),
                   "revenue": sum(r["fare"] for r in done if r["created_at"][:10] == d)} for d in days],
    }


@api.get("/admin/drivers")
async def admin_drivers(status: Optional[str] = None, admin: dict = Depends(require_role("admin"))):
    q = {"status": status} if status else {}
    return await db.drivers.find(q, {"_id": 0}).sort("applied_at", -1).to_list(1000)


class DecisionIn(BaseModel):
    approve: bool


@api.post("/admin/drivers/{user_id}/decision")
async def admin_driver_decision(user_id: str, body: DecisionIn, admin: dict = Depends(require_role("admin"))):
    d = await db.drivers.find_one_and_update(
        {"user_id": user_id}, {"$set": {"status": "approved" if body.approve else "rejected", "decided_at": now_iso(),
                                        **({} if body.approve else {"online": False})}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not d:
        raise HTTPException(404, "Not found")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if target and effective_role(target.get("role")) != "admin":
        await db.users.update_one({"user_id": user_id}, {"$set": {"role": "driver" if body.approve else "customer"}})
    return d


@api.get("/admin/bookings")
async def admin_bookings(status: Optional[str] = None, service: Optional[str] = None,
                         admin: dict = Depends(require_role("admin"))):
    q = {}
    if status:
        q["status"] = status
    if service:
        q["service"] = service
    return await db.bookings.find(q, {"_id": 0, "razorpay_order_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/users")
async def list_users(admin: dict = Depends(require_role("admin"))):
    people = await db.users.find(IN_ENV, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"roles": [r for r in ROLES if RANK[r] <= RANK[admin["role"]]],
            "users": [{**p, "role": effective_role(p.get("role"))} for p in people]}


class RoleIn(BaseModel):
    role: str


@api.patch("/users/{user_id}/role")
async def set_role(user_id: str, body: RoleIn, admin: dict = Depends(require_role("admin"))):
    if body.role not in ROLES or RANK[body.role] > RANK[admin["role"]]:
        raise HTTPException(status_code=403, detail="Not allowed")
    target = await db.users.find_one({"user_id": user_id, **IN_ENV}, {"_id": 0})
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    if (effective_role(target.get("role")) == "admin" and body.role != "admin"
            and await db.users.count_documents({"role": "admin", **IN_ENV}) <= 1):
        raise HTTPException(status_code=409, detail="Keep at least one admin")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    return {"user_id": user_id, "role": body.role}


@api.get("/")
async def root():
    return {"message": "Safar API"}


app.include_router(api)
app.include_router(clerk_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    await seed_fares()
    for old, new in RETIRED_ROLES.items():
        await db.users.update_many({"role": old}, {"$set": {"role": new}})


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
