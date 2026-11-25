import { Router } from "express";
import { z } from "zod";
import { col, nowIso } from "../db.js";
import { currentMember, driverProfile, requireRole } from "../roles.js";
import { HttpError, parse, pyRound } from "../util.js";

export const router = Router();

// ---------- Fares ----------
router.get("/fares", currentMember, async (req, res) => {
  res.json(await col("fares").find({}, { projection: { _id: 0 } }).limit(100).toArray());
});

const FareUpdate = z.object({
  base: z.number().gte(0), per_km: z.number().gte(0), per_min: z.number().gte(0),
  min_fare: z.number().gte(0), per_hour: z.number().gte(0), active: z.boolean(),
});

router.put("/admin/fares/:key", ...requireRole("admin"), async (req, res) => {
  const body = parse(FareUpdate, req.body);
  const doc = await col("fares").findOneAndUpdate({ key: req.params.key }, { $set: body },
    { projection: { _id: 0 }, returnDocument: "after" });
  if (!doc) throw new HttpError(404, "Not found");
  res.json(doc);
});

// ---------- Geo (OpenStreetMap) ----------
const NOMINATIM = "https://nominatim.openstreetmap.org";
const GEO_HEADERS = { "User-Agent": "SafarMobilityApp/1.0 (ride booking)", "Accept-Language": "en" };
const geoCache = new Map();

async function geo(path, params) {
  const ck = path + JSON.stringify(Object.entries(params).sort());
  if (geoCache.has(ck)) return geoCache.get(ck);
  let data;
  try {
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), format: "jsonv2" });
    const r = await fetch(`${NOMINATIM}/${path}?${qs}`, { headers: GEO_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    data = await r.json();
  } catch {
    throw new HttpError(502, "Location search is unavailable right now");
  }
  if (geoCache.size > 2000) geoCache.clear();
  geoCache.set(ck, data);
  return data;
}

router.get("/geo/search", currentMember, async (req, res) => {
  const { q } = parse(z.object({ q: z.string().min(3).max(120) }), req.query, "query");
  const data = await geo("search", { q, countrycodes: "in", limit: 6, addressdetails: 0 });
  res.json(data.map((d) => ({ address: d.display_name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) })));
});

router.get("/geo/reverse", currentMember, async (req, res) => {
  const { lat, lon } = parse(z.object({ lat: z.coerce.number(), lon: z.coerce.number() }), req.query, "query");
  const d = await geo("reverse", { lat: pyRound(lat, 5), lon: pyRound(lon, 5), zoom: 17 });
  res.json({ address: d.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon });
});

// ---------- Profile ----------
const ProfileIn = z.object({ name: z.string().min(1).max(80), phone: z.string().max(15).default("") });

router.get("/me", currentMember, async (req, res) => {
  res.json({ ...req.member, driver: await driverProfile(req.member.user_id) });
});

router.put("/me", currentMember, async (req, res) => {
  const body = parse(ProfileIn, req.body);
  await col("users").updateOne({ user_id: req.member.user_id }, { $set: body });
  res.json({ ...req.member, ...body });
});

router.get("/", (req, res) => res.json({ message: "Safar API" }));

export { nowIso };
