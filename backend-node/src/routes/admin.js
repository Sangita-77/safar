import { Router } from "express";
import { z } from "zod";
import { col, nowIso } from "../db.js";
import { COMMISSION, IN_ENV, RANK, ROLES, effectiveRole, requireRole } from "../roles.js";
import { HttpError, parse, pyRound } from "../util.js";
import { ACTIVE } from "./bookings.js";

export const router = Router();
const admin = requireRole("admin");

router.get("/admin/stats", ...admin, async (req, res) => {
  const rows = await col("bookings").find({}, { projection: { _id: 0, status: 1, fare: 1, service: 1, created_at: 1, payment_status: 1 } })
    .limit(20000).toArray();
  const done = rows.filter((r) => r.status === "completed");
  const fareSum = (list) => list.reduce((s, r) => s + r.fare, 0);
  const days = [];
  for (let i = 6; i >= 0; i -= 1) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const drivers = col("drivers");
  res.json({
    bookings_total: rows.length,
    bookings_active: rows.filter((r) => ACTIVE.includes(r.status)).length,
    bookings_completed: done.length,
    bookings_cancelled: rows.filter((r) => r.status === "cancelled").length,
    gross_revenue: fareSum(done),
    platform_earnings: pyRound(fareSum(done) * COMMISSION),
    customers: await col("users").countDocuments({ role: "customer", ...IN_ENV }),
    drivers_approved: await drivers.countDocuments({ status: "approved" }),
    drivers_pending: await drivers.countDocuments({ status: "pending" }),
    drivers_online: await drivers.countDocuments({ status: "approved", online: true }),
    by_service: Object.fromEntries(["ride", "parcel", "rental"].map((s) => [s, rows.filter((r) => r.service === s).length])),
    daily: days.map((d) => ({
      day: d.slice(5),
      bookings: rows.filter((r) => r.created_at.slice(0, 10) === d).length,
      revenue: fareSum(done.filter((r) => r.created_at.slice(0, 10) === d)),
    })),
  });
});

router.get("/admin/drivers", ...admin, async (req, res) => {
  const q = req.query.status ? { status: String(req.query.status) } : {};
  res.json(await col("drivers").find(q, { projection: { _id: 0 } }).sort({ applied_at: -1 }).limit(1000).toArray());
});

router.post("/admin/drivers/:userId/decision", ...admin, async (req, res) => {
  const { approve } = parse(z.object({ approve: z.boolean() }), req.body);
  const { userId } = req.params;
  const d = await col("drivers").findOneAndUpdate(
    { user_id: userId },
    { $set: { status: approve ? "approved" : "rejected", decided_at: nowIso(), ...(approve ? {} : { online: false }) } },
    { projection: { _id: 0 }, returnDocument: "after" });
  if (!d) throw new HttpError(404, "Not found");
  const target = await col("users").findOne({ user_id: userId }, { projection: { _id: 0 } });
  if (target && effectiveRole(target.role) !== "admin") {
    await col("users").updateOne({ user_id: userId }, { $set: { role: approve ? "driver" : "customer" } });
  }
  res.json(d);
});

router.get("/admin/bookings", ...admin, async (req, res) => {
  const q = {};
  if (req.query.status) q.status = String(req.query.status);
  if (req.query.service) q.service = String(req.query.service);
  res.json(await col("bookings").find(q, { projection: { _id: 0, razorpay_order_id: 0 } }).sort({ created_at: -1 }).limit(500).toArray());
});

router.get("/users", ...admin, async (req, res) => {
  const people = await col("users").find(IN_ENV, { projection: { _id: 0, password_hash: 0 } }).sort({ created_at: -1 }).limit(2000).toArray();
  res.json({
    roles: ROLES.filter((r) => RANK[r] <= RANK[req.member.role]),
    users: people.map((p) => ({ ...p, role: effectiveRole(p.role) })),
  });
});

router.patch("/users/:userId/role", ...admin, async (req, res) => {
  const { role } = parse(z.object({ role: z.string() }), req.body);
  const { userId } = req.params;
  if (!ROLES.includes(role) || RANK[role] > RANK[req.member.role]) throw new HttpError(403, "Not allowed");
  const target = await col("users").findOne({ user_id: userId, ...IN_ENV }, { projection: { _id: 0 } });
  if (!target) throw new HttpError(404, "Not found");
  if (effectiveRole(target.role) === "admin" && role !== "admin"
      && (await col("users").countDocuments({ role: "admin", ...IN_ENV })) <= 1) {
    throw new HttpError(409, "Keep at least one admin");
  }
  await col("users").updateOne({ user_id: userId }, { $set: { role } });
  res.json({ user_id: userId, role });
});
