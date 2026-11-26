import crypto from "node:crypto";
import express, { Router } from "express";
import { createLocalJWKSet, jwtVerify, errors as joseErrors } from "jose";
import { z } from "zod";
import { col, nowIso } from "./db.js";
import { HttpError, parse } from "./util.js";

const CLERK_FRONTEND_API = "https://frontend-api.clerk.dev";
export const CLERK_BACKEND_API = "https://api.clerk.com/v1";
const PROXY_PATH = "/api/__clerk";
const HOP = new Set([
  "host", "connection", "keep-alive", "content-length", "transfer-encoding", "te", "trailer",
  "upgrade", "proxy-authorization", "proxy-authenticate", "content-encoding",
]);

const publishableKey = () => process.env.CLERK_PUBLISHABLE_KEY || "";
export const secretKey = () => process.env.CLERK_SECRET_KEY || "";
export const clerkConfigured = () => Boolean(publishableKey() && secretKey());
const isProduction = () => publishableKey().startsWith("pk_live_");
const jwtSecret = () => process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY || process.env.MONGO_URL || "safar-jwt-secret-key";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const hash = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHash, "hex");
  return hash.length === original.length && crypto.timingSafeEqual(hash, original);
}

function signAuthToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 86400,
    }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", jwtSecret()).update(payload).digest("base64url");
  return `safar.${payload}.${sig}`;
}

function verifyAuthToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "safar") {
    throw new HttpError(401, "Invalid or expired session");
  }
  const [, payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", jwtSecret()).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpError(401, "Invalid or expired session");
  }
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  if (!payload.sub || (payload.exp && payload.exp < Math.floor(Date.now() / 1000))) {
    throw new HttpError(401, "Session expired. Please sign in again.");
  }
  return payload;
}

function isConfiguredAdminEmail(email) {
  const admins = new Set(
    (process.env.ADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  return admins.has(String(email || "").trim().toLowerCase());
}

function sanitizeUser(user) {
  if (!user) return null;
  const copy = { ...user };
  delete copy._id;
  delete copy.password_hash;
  return copy;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"] || "";
  return fwd ? String(fwd).split(",")[0].trim() : req.socket.remoteAddress || "";
}

export const clerkRouter = Router();

clerkRouter.get("/clerk/config", (req, res) => {
  const key = publishableKey();
  if (clerkConfigured()) {
    return res.json({
      enabled: true,
      mode: "clerk",
      publishable_key: key,
      proxy_url: isProduction() ? PROXY_PATH : "",
    });
  }
  return res.json({
    enabled: true,
    mode: "credentials",
    publishable_key: "safar_credentials_auth",
    proxy_url: "",
  });
});

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters").max(80),
  email: z.string().trim().email("Please enter a valid email address"),
  phone: z.string().trim().max(15).optional().default(""),
  password: z.string().min(6, "Password must be at least 6 characters").max(120),
});

const LoginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required").max(120),
});

clerkRouter.post("/auth/register", express.json(), async (req, res) => {
  const body = parse(RegisterSchema, req.body);
  const cleanEmail = body.email.toLowerCase();
  const users = col("users");
  const existing = await users.findOne({ email: cleanEmail });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists. Please sign in.");
  }
  const env = isProduction() ? "live" : "preview";
  const role = isConfiguredAdminEmail(cleanEmail) ? "admin" : "customer";
  const user = {
    user_id: `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    email: cleanEmail,
    name: body.name,
    phone: body.phone || "",
    role,
    env,
    password_hash: hashPassword(body.password),
    created_at: nowIso(),
  };
  await users.insertOne({ ...user });
  const token = signAuthToken(user.user_id);
  return res.status(201).json({ token, user: sanitizeUser(user) });
});

clerkRouter.post("/auth/login", express.json(), async (req, res) => {
  const body = parse(LoginSchema, req.body);
  const cleanEmail = body.email.toLowerCase();
  const users = col("users");
  const user = await users.findOne({ email: cleanEmail });
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    throw new HttpError(401, "Invalid email or password");
  }
  if (isConfiguredAdminEmail(cleanEmail) && user.role !== "admin") {
    await users.updateOne({ user_id: user.user_id }, { $set: { role: "admin" } });
    user.role = "admin";
  }
  const token = signAuthToken(user.user_id);
  return res.json({ token, user: sanitizeUser(user) });
});

// Relay Clerk's Frontend API through this app's own domain (production only).
clerkRouter.all("/__clerk/*path", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
  if (!isProduction()) throw new HttpError(404, "Not Found");
  const sub = [].concat(req.params.path || []).join("/");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k.toLowerCase())) headers[k] = v;
  headers["Clerk-Proxy-Url"] = `https://${host}${PROXY_PATH}`;
  headers["Clerk-Secret-Key"] = secretKey();
  headers["X-Forwarded-For"] = clientIp(req);
  headers["Accept-Encoding"] = "gzip";
  const qs = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  let upstream;
  try {
    upstream = await fetch(`${CLERK_FRONTEND_API}/${sub}${qs}`, {
      method: req.method, headers, redirect: "manual", signal: AbortSignal.timeout(30000),
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    });
  } catch {
    return res.status(502).end();
  }
  res.status(upstream.status);
  upstream.headers.forEach((v, k) => {
    if (!HOP.has(k) && k !== "set-cookie") res.append(k, v);
  });
  for (const c of upstream.headers.getSetCookie()) res.append("set-cookie", c);
  res.end(Buffer.from(await upstream.arrayBuffer()));
});

let jwks = null;
let jwksAt = 0;

async function loadJwks(force) {
  if (!force && jwks && Date.now() - jwksAt < 3600_000) return jwks;
  const r = await fetch(`${CLERK_BACKEND_API}/jwks`, {
    headers: { Authorization: `Bearer ${secretKey()}`, "User-Agent": "emergent-clerk-auth" },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new HttpError(401, "Invalid or expired session");
  jwks = createLocalJWKSet(await r.json());
  jwksAt = Date.now();
  return jwks;
}

async function verifySessionToken(token) {
  try {
    try {
      return (await jwtVerify(token, await loadJwks(false), { algorithms: ["RS256"], clockTolerance: 5 })).payload;
    } catch (e) {
      if (!(e instanceof joseErrors.JWKSNoMatchingKey)) throw e;
      return (await jwtVerify(token, await loadJwks(true), { algorithms: ["RS256"], clockTolerance: 5 })).payload;
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, "Invalid or expired session");
  }
}

function sessionCookie(req) {
  const raw = req.headers.cookie || "";
  const hit = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith("__session="));
  return hit ? decodeURIComponent(hit.slice("__session=".length)) : "";
}

// The signed-in user from `Authorization: Bearer` or Clerk's `__session` cookie.
export async function requireUser(req) {
  const auth = String(req.headers.authorization || "");
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : sessionCookie(req);
  if (!token) throw new HttpError(401, "Not signed in");
  if (token.startsWith("safar.")) {
    const claims = verifyAuthToken(token);
    req.user = { user_id: claims.sub, session_id: "safar_session", claims };
    return req.user;
  }
  if (!secretKey()) throw new HttpError(401, "Invalid or expired session. Please sign in.");
  const claims = await verifySessionToken(token);
  req.user = { user_id: claims.sub, session_id: claims.sid, claims };
  return req.user;
}
