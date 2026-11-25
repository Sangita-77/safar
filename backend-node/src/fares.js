import { z } from "zod";
import { col } from "./db.js";
import { HttpError, pyRound } from "./util.js";

export const DEFAULT_FARES = [
  { key: "bike", label: "Bike", service: "ride", vehicle: "bike", capacity: 1, base: 20, per_km: 7, per_min: 1, min_fare: 30, per_hour: 0, speed: 28 },
  { key: "erickshaw", label: "E-Rickshaw", service: "ride", vehicle: "erickshaw", capacity: 4, base: 25, per_km: 9, per_min: 1, min_fare: 35, per_hour: 0, speed: 15 },
  { key: "car_mini", label: "Cab Mini", service: "ride", vehicle: "car", capacity: 4, base: 50, per_km: 12, per_min: 1.5, min_fare: 90, per_hour: 0, speed: 24 },
  { key: "car_sedan", label: "Cab Sedan", service: "ride", vehicle: "car", capacity: 4, base: 60, per_km: 14, per_min: 1.8, min_fare: 110, per_hour: 0, speed: 24 },
  { key: "car_suv", label: "Cab XL (SUV)", service: "ride", vehicle: "car", capacity: 6, base: 80, per_km: 18, per_min: 2, min_fare: 150, per_hour: 0, speed: 24 },
  { key: "parcel_bike", label: "Parcel by Bike", service: "parcel", vehicle: "bike", capacity: 0, base: 30, per_km: 8, per_min: 0.5, min_fare: 45, per_hour: 0, speed: 28 },
  { key: "parcel_van", label: "Parcel by Mini Van", service: "parcel", vehicle: "van", capacity: 0, base: 150, per_km: 22, per_min: 1, min_fare: 250, per_hour: 0, speed: 20 },
  { key: "rental_bike", label: "Bike Rental", service: "rental", vehicle: "bike", capacity: 1, base: 0, per_km: 0, per_min: 0, min_fare: 99, per_hour: 99, speed: 28 },
  { key: "rental_car", label: "Cab Rental", service: "rental", vehicle: "car", capacity: 4, base: 0, per_km: 0, per_min: 0, min_fare: 299, per_hour: 299, speed: 24 },
];

export async function seedFares() {
  for (const f of DEFAULT_FARES) {
    await col("fares").updateOne({ key: f.key }, { $setOnInsert: { ...f, active: true } }, { upsert: true });
  }
}

export const Place = z.object({
  address: z.string().min(2).max(300),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

export function haversineKm(a, b) {
  const r = 6371.0;
  const rad = (d) => (d * Math.PI) / 180;
  const p1 = rad(a.lat);
  const p2 = rad(b.lat);
  const dp = p2 - p1;
  const dl = rad(b.lon - a.lon);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function quote(fare, km, hours) {
  if (fare.service === "rental") {
    const amount = Math.max(fare.min_fare, fare.per_hour * hours);
    return { fare: pyRound(amount), distance_km: 0, duration_min: hours * 60 };
  }
  const minutes = (km / Math.max(fare.speed || 20, 5)) * 60;
  const amount = Math.max(fare.min_fare, fare.base + fare.per_km * km + fare.per_min * minutes);
  return { fare: pyRound(amount), distance_km: pyRound(km, 1), duration_min: pyRound(minutes) };
}

export function tripKm(body) {
  if (body.service === "rental") return 0.0;
  if (!body.drop) throw new HttpError(422, "Drop location is required");
  const km = haversineKm(body.pickup, body.drop) * 1.3;
  if (km > 300) throw new HttpError(422, "Trips longer than 300 km are not supported");
  return Math.max(km, 0.5);
}
