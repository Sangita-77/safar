import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { col, nowIso } from "../db.js";
import { currentMember, driverProfile } from "../roles.js";
import { Place, quote, tripKm } from "../fares.js";
import { HttpError, parse, randInt } from "../util.js";

export const router = Router();
export const ACTIVE = ["searching", "accepted", "arrived", "ongoing"];

const Service = z.enum(["ride", "parcel", "rental"]);
const EstimateIn = z.object({
  service: Service,
  pickup: Place,
  drop: Place.nullable().optional().default(null),
  hours: z.number().int().gte(1).lte(12).default(2),
});
const ParcelInfo = z.object({
  receiver_name: z.string().min(1).max(80),
  receiver_phone: z.string().min(10).max(15),
  item: z.string().min(1).max(120),
  weight_kg: z.number().gt(0).lte(500).default(1),
});
const BookingIn = EstimateIn.extend({
  fare_key: z.string(),
  payment_method: z.enum(["cash", "online"]),
  parcel: ParcelInfo.nullable().optional().default(null),
});

export const paymentsEnabled = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export function viewBooking(b, viewer) {
  const out = { ...b };
  delete out.razorpay_order_id;
  if (viewer.role !== "admin" && viewer.user_id !== b.customer_id) delete out.otp;
  return out;
}

export async function expireStale() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString().replace("Z", "+00:00");
  await col("bookings").updateMany({ status: "searching", created_at: { $lt: cutoff } },
    { $set: { status: "cancelled", cancelled_by: "system", cancel_reason: "No driver was available", updated_at: nowIso() } });
}

router.post("/bookings/estimate", currentMember, async (req, res) => {
  const body = parse(EstimateIn, req.body);
  const km = tripKm(body);
  const fares = await col("fares").find({ service: body.service, active: true }, { projection: { _id: 0 } }).limit(50).toArray();
  const out = [];
  for (const f of fares) {
    const online = await col("drivers").countDocuments({ status: "approved", online: true, vehicle_type: f.vehicle });
    out.push({ fare_key: f.key, label: f.label, vehicle: f.vehicle, capacity: f.capacity, drivers_online: online, ...quote(f, km, body.hours) });
  }
  res.json(out);
});

router.post("/bookings", currentMember, async (req, res) => {
  const body = parse(BookingIn, req.body);
  const m = req.member;
  await expireStale();
  if (await col("bookings").findOne({ customer_id: m.user_id, status: { $in: ACTIVE } }, { projection: { _id: 0, id: 1 } })) {
    throw new HttpError(409, "You already have an active booking");
  }
  const fare = await col("fares").findOne({ key: body.fare_key, service: body.service, active: true }, { projection: { _id: 0 } });
  if (!fare) throw new HttpError(422, "This vehicle option is not available");
  if (body.payment_method === "online" && !paymentsEnabled()) throw new HttpError(422, "Online payment is not available yet. Please choose cash.");
  if (body.service === "parcel" && !body.parcel) throw new HttpError(422, "Receiver details are required for parcels");
  const q = quote(fare, tripKm(body), body.hours);
  const doc = {
    id: crypto.randomUUID(), code: "SF" + randInt(100000, 999999),
    customer_id: m.user_id, customer_name: m.name || "", customer_phone: m.phone || "",
    service: body.service, fare_key: fare.key, vehicle_label: fare.label, vehicle: fare.vehicle,
    pickup: body.pickup, drop: body.drop && body.service !== "rental" ? body.drop : null,
    hours: body.service === "rental" ? body.hours : null,
    parcel: body.service === "parcel" ? body.parcel : null,
    ...q, payment_method: body.payment_method, payment_status: "pending",
    status: "searching", otp: String(randInt(0, 9999)).padStart(4, "0"),
    driver_id: null, driver: null, rating: null, created_at: nowIso(), updated_at: nowIso(),
  };
  await col("bookings").insertOne({ ...doc });
  res.json(viewBooking(doc, m));
});

router.get("/bookings", currentMember, async (req, res) => {
  const rows = await col("bookings").find({ customer_id: req.member.user_id }, { projection: { _id: 0 } })
    .sort({ created_at: -1 }).limit(200).toArray();
  res.json(rows.map((b) => viewBooking(b, req.member)));
});

router.get("/bookings/active", currentMember, async (req, res) => {
  await expireStale();
  const b = await col("bookings").findOne({ customer_id: req.member.user_id, status: { $in: ACTIVE } }, { projection: { _id: 0 } });
  res.json(b ? viewBooking(b, req.member) : null);
});

router.get("/bookings/:bid", currentMember, async (req, res) => {
  await expireStale();
  const m = req.member;
  const scope = m.role === "admin" ? {} : { $or: [{ customer_id: m.user_id }, { driver_id: m.user_id }] };
  const b = await col("bookings").findOne({ id: req.params.bid, ...scope }, { projection: { _id: 0 } });
  if (!b) throw new HttpError(404, "Not found");
  const out = viewBooking(b, m);
  if (b.driver_id && ACTIVE.includes(b.status)) {
    const d = await driverProfile(b.driver_id);
    out.driver_location = d ? d.location ?? null : null;
  }
  res.json(out);
});

router.post("/bookings/:bid/cancel", currentMember, async (req, res) => {
  const b = await col("bookings").findOneAndUpdate(
    { id: req.params.bid, customer_id: req.member.user_id, status: { $in: ["searching", "accepted", "arrived"] } },
    { $set: { status: "cancelled", cancelled_by: "customer", updated_at: nowIso() } },
    { projection: { _id: 0 }, returnDocument: "after" });
  if (!b) throw new HttpError(409, "This booking can no longer be cancelled");
  res.json(viewBooking(b, req.member));
});

const RateIn = z.object({ rating: z.number().int().gte(1).lte(5), comment: z.string().max(300).default("") });

router.post("/bookings/:bid/rate", currentMember, async (req, res) => {
  const body = parse(RateIn, req.body);
  const b = await col("bookings").findOneAndUpdate(
    { id: req.params.bid, customer_id: req.member.user_id, status: "completed", rating: null },
    { $set: { rating: body.rating, rating_comment: body.comment } },
    { projection: { _id: 0 }, returnDocument: "after" });
  if (!b) throw new HttpError(409, "This trip can't be rated");
  const rated = await col("bookings").find({ driver_id: b.driver_id, rating: { $ne: null } }, { projection: { _id: 0, rating: 1 } }).limit(5000).toArray();
  const avg = Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 100) / 100;
  await col("drivers").updateOne({ user_id: b.driver_id }, { $set: { rating: avg, ratings_count: rated.length } });
  res.json(viewBooking(b, req.member));
});
