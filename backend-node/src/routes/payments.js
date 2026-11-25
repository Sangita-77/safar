import crypto from "node:crypto";
import { Router } from "express";
import Razorpay from "razorpay";
import { z } from "zod";
import { col, nowIso } from "../db.js";
import { currentMember } from "../roles.js";
import { HttpError, parse, safeEqual } from "../util.js";
import { paymentsEnabled } from "./bookings.js";

export const router = Router();

const rzp = () => new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

router.get("/payments/config", currentMember, (req, res) => {
  res.json({ enabled: paymentsEnabled(), key_id: paymentsEnabled() ? process.env.RAZORPAY_KEY_ID : "" });
});

router.post("/payments/order", currentMember, async (req, res) => {
  const { booking_id } = parse(z.object({ booking_id: z.string() }), req.body);
  const m = req.member;
  if (!paymentsEnabled()) throw new HttpError(422, "Online payment is not available");
  const b = await col("bookings").findOne({ id: booking_id, customer_id: m.user_id, payment_method: "online",
    payment_status: "pending", status: "completed" }, { projection: { _id: 0 } });
  if (!b) throw new HttpError(409, "Nothing to pay for this booking");
  let order;
  try {
    order = await rzp().orders.create({ amount: b.fare * 100, currency: "INR", receipt: b.code, payment_capture: 1 });
  } catch (e) {
    console.error("razorpay order:", e?.error || e?.message || e);
    throw new HttpError(502, "Payment gateway error. Please try again.");
  }
  await col("bookings").updateOne({ id: b.id }, { $set: { razorpay_order_id: order.id } });
  res.json({ order_id: order.id, amount: order.amount, currency: "INR", key_id: process.env.RAZORPAY_KEY_ID,
    name: m.name || "", email: m.email || "", contact: m.phone || "" });
});

const PayVerifyIn = z.object({
  booking_id: z.string(), razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string(),
});

router.post("/payments/verify", currentMember, async (req, res) => {
  const body = parse(PayVerifyIn, req.body);
  const b = await col("bookings").findOne({ id: body.booking_id, customer_id: req.member.user_id }, { projection: { _id: 0 } });
  if (!b || b.razorpay_order_id !== body.razorpay_order_id) throw new HttpError(404, "Not found");
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`).digest("hex");
  if (!safeEqual(expected, body.razorpay_signature)) throw new HttpError(400, "Payment verification failed");
  await col("bookings").updateOne({ id: b.id }, { $set: { payment_status: "paid", razorpay_payment_id: body.razorpay_payment_id, paid_at: nowIso() } });
  res.json({ ok: true });
});
