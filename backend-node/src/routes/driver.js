import { Router } from "express";
import { z } from "zod";
import { col, nowIso } from "../db.js";
import { COMMISSION, ENV, currentDriver, currentMember, driverProfile } from "../roles.js";
import { haversineKm } from "../fares.js";
import { HttpError, parse, pyRound, randInt, safeEqual } from "../util.js";
import { ACTIVE, expireStale, viewBooking } from "./bookings.js";

export const router = Router();

const DriverApply = z.object({
  vehicle_type: z.enum(["bike", "erickshaw", "car", "van"]),
  vehicle_model: z.string().min(2).max(60),
  vehicle_number: z.string().min(4).max(15),
  license_number: z.string().min(5).max(25),
  phone: z.string().min(10).max(15),
  city: z.string().min(2).max(60),
});

router.post("/driver/apply", currentMember, async (req, res) => {
  const body = parse(DriverApply, req.body);
  const m = req.member;
  const existing = await driverProfile(m.user_id);
  if (existing && ["pending", "approved"].includes(existing.status)) throw new HttpError(409, "You have already applied");
  const data = { ...body, vehicle_number: body.vehicle_number.toUpperCase().replaceAll(" ", "") };
  await col("drivers").updateOne(
    { user_id: m.user_id },
    {
      $set: { ...data, status: "pending", name: m.name || "", email: m.email || "", applied_at: nowIso(), env: ENV },
      $setOnInsert: { user_id: m.user_id, online: false, rating: null, ratings_count: 0, location: null },
    },
    { upsert: true });
  await col("users").updateOne({ user_id: m.user_id }, { $set: { phone: body.phone } });
  res.json(await driverProfile(m.user_id));
});

router.post("/driver/status", ...currentDriver, async (req, res) => {
  const { online } = parse(z.object({ online: z.boolean() }), req.body);
  await col("drivers").updateOne({ user_id: req.member.user_id }, { $set: { online } });
  res.json(await driverProfile(req.member.user_id));
});

router.post("/driver/location", ...currentDriver, async (req, res) => {
  const body = parse(z.object({ lat: z.number().gte(-90).lte(90), lon: z.number().gte(-180).lte(180) }), req.body);
  await col("drivers").updateOne({ user_id: req.member.user_id }, { $set: { location: { ...body, at: nowIso() } } });
  res.json({ ok: true });
});

router.get("/driver/requests", ...currentDriver, async (req, res) => {
  const d = req.member.driver;
  if (!d.online) return res.json([]);
  await expireStale();
  const rows = await col("bookings").find({ status: "searching", vehicle: d.vehicle_type, released_by: { $ne: req.member.user_id } },
    { projection: { _id: 0, otp: 0, razorpay_order_id: 0 } }).sort({ created_at: -1 }).limit(50).toArray();
  const loc = d.location;
  if (loc) {
    for (const r of rows) r.pickup_km = pyRound(haversineKm(loc, r.pickup), 1);
    rows.sort((a, b) => (a.pickup_km ?? 9999) - (b.pickup_km ?? 9999));
  }
  res.json(rows);
});

router.get("/driver/active", ...currentDriver, async (req, res) => {
  const b = await col("bookings").findOne({ driver_id: req.member.user_id, status: { $in: ACTIVE } }, { projection: { _id: 0 } });
  res.json(b ? viewBooking(b, req.member) : null);
});

router.post("/driver/bookings/:bid/accept", ...currentDriver, async (req, res) => {
  const m = req.member;
  const d = m.driver;
  if (await col("bookings").findOne({ driver_id: m.user_id, status: { $in: ACTIVE } }, { projection: { _id: 0, id: 1 } })) {
    throw new HttpError(409, "Finish your current trip first");
  }
  const info = { name: d.name || m.name || "", phone: d.phone || "", vehicle_model: d.vehicle_model, vehicle_number: d.vehicle_number, rating: d.rating ?? null };
  const b = await col("bookings").findOneAndUpdate(
    { id: req.params.bid, status: "searching", vehicle: d.vehicle_type, released_by: { $ne: m.user_id } },
    { $set: { status: "accepted", driver_id: m.user_id, driver: info, accepted_at: nowIso(), updated_at: nowIso() } },
    { projection: { _id: 0 }, returnDocument: "after" });
  if (!b) throw new HttpError(409, "This request was taken or cancelled");
  res.json(viewBooking(b, m));
});

async function transition(bid, uid, from, update) {
  const b = await col("bookings").findOneAndUpdate({ id: bid, driver_id: uid, status: { $in: from } },
    { $set: { ...update, updated_at: nowIso() } }, { projection: { _id: 0 }, returnDocument: "after" });
  if (!b) throw new HttpError(409, "This action is not possible right now");
  return b;
}

router.post("/driver/bookings/:bid/arrived", ...currentDriver, async (req, res) => {
  res.json(viewBooking(await transition(req.params.bid, req.member.user_id, ["accepted"], { status: "arrived", arrived_at: nowIso() }), req.member));
});

router.post("/driver/bookings/:bid/start", ...currentDriver, async (req, res) => {
  const { otp } = parse(z.object({ otp: z.string().min(4).max(4) }), req.body);
  const { bid } = req.params;
  const uid = req.member.user_id;
  const b = await col("bookings").findOne({ id: bid, driver_id: uid, status: { $in: ["accepted", "arrived"] } }, { projection: { _id: 0 } });
  if (!b) throw new HttpError(409, "This action is not possible right now");
  const attempts = b.otp_attempts || 0;
  if (attempts >= 5) throw new HttpError(429, "Too many wrong OTP attempts. Release this trip or ask the customer to rebook.");
  if (!safeEqual(b.otp, otp)) {
    await col("bookings").updateOne({ id: bid }, { $inc: { otp_attempts: 1 } });
    throw new HttpError(400, `Incorrect OTP (${4 - attempts} attempts left)`);
  }
  res.json(viewBooking(await transition(bid, uid, ["accepted", "arrived"], { status: "ongoing", started_at: nowIso() }), req.member));
});

router.post("/driver/bookings/:bid/release", ...currentDriver, async (req, res) => {
  const uid = req.member.user_id;
  const b = await transition(req.params.bid, uid, ["accepted", "arrived"], {
    status: "searching", driver_id: null, driver: null, otp_attempts: 0,
    otp: String(randInt(0, 9999)).padStart(4, "0"), created_at: nowIso(),
  });
  await col("bookings").updateOne({ id: req.params.bid }, { $push: { released_by: uid } });
  res.json({ id: b.id, status: b.status });
});

router.post("/driver/bookings/:bid/complete", ...currentDriver, async (req, res) => {
  const uid = req.member.user_id;
  const b = await col("bookings").findOne({ id: req.params.bid, driver_id: uid, status: "ongoing" }, { projection: { _id: 0 } });
  if (!b) throw new HttpError(409, "This action is not possible right now");
  const upd = { status: "completed", completed_at: nowIso(), driver_earning: pyRound(b.fare * (1 - COMMISSION)) };
  if (b.payment_method === "cash") upd.payment_status = "paid";
  res.json(viewBooking(await transition(req.params.bid, uid, ["ongoing"], upd), req.member));
});

router.get("/driver/trips", ...currentDriver, async (req, res) => {
  const rows = await col("bookings").find({ driver_id: req.member.user_id }, { projection: { _id: 0, otp: 0, razorpay_order_id: 0 } })
    .sort({ created_at: -1 }).limit(300).toArray();
  const today = new Date().toISOString().slice(0, 10);
  const done = rows.filter((r) => r.status === "completed");
  const isToday = (r) => (r.completed_at || "").slice(0, 10) === today;
  const sum = (list) => list.reduce((s, r) => s + (r.driver_earning || 0), 0);
  res.json({
    trips: rows,
    summary: { completed: done.length, earnings_total: sum(done), earnings_today: sum(done.filter(isToday)), trips_today: done.filter(isToday).length },
  });
});
