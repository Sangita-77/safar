import express, { Router } from "express";
import { createLocalJWKSet, jwtVerify, errors as joseErrors } from "jose";
import { HttpError } from "./util.js";

const CLERK_FRONTEND_API = "https://frontend-api.clerk.dev";
export const CLERK_BACKEND_API = "https://api.clerk.com/v1";
const PROXY_PATH = "/api/__clerk";
const HOP = new Set(["host", "connection", "keep-alive", "content-length", "transfer-encoding", "te", "trailer",
  "upgrade", "proxy-authorization", "proxy-authenticate", "content-encoding"]);

const publishableKey = () => process.env.CLERK_PUBLISHABLE_KEY || "";
export const secretKey = () => process.env.CLERK_SECRET_KEY || "";
const isProduction = () => publishableKey().startsWith("pk_live_");

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"] || "";
  return fwd ? String(fwd).split(",")[0].trim() : req.socket.remoteAddress || "";
}

export const clerkRouter = Router();

clerkRouter.get("/clerk/config", (req, res) => {
  const key = publishableKey();
  res.json({ enabled: Boolean(key && secretKey()), publishable_key: key, proxy_url: isProduction() ? PROXY_PATH : "" });
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
  if (!secretKey()) throw new HttpError(503, "Clerk is not configured");
  const auth = String(req.headers.authorization || "");
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : sessionCookie(req);
  if (!token) throw new HttpError(401, "Not signed in");
  const claims = await verifySessionToken(token);
  req.user = { user_id: claims.sub, session_id: claims.sid, claims };
  return req.user;
}
