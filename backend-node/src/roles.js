import { col, nowIso } from "./db.js";
import { CLERK_BACKEND_API, requireUser, secretKey } from "./clerk.js";
import { HttpError } from "./util.js";

// The role list is code, so every publish ships it. Highest first; keep `admin`.
export const ROLES = ["admin", "driver", "customer"];
export const DEFAULT_ROLE = "customer";
export const RETIRED_ROLES = {};
export const RANK = Object.fromEntries(ROLES.map((r, i) => [r, ROLES.length - i]));
export const ENV = (process.env.CLERK_PUBLISHABLE_KEY || "").startsWith("pk_live_") ? "live" : "preview";
export const IN_ENV = { env: { $in: [ENV, null] } };
export const COMMISSION = 0.2;

export function effectiveRole(role) {
  const r = RETIRED_ROLES[role] ?? role;
  return ROLES.includes(r) ? r : DEFAULT_ROLE;
}

async function clerkUser(userId) {
  const r = await fetch(`${CLERK_BACKEND_API}/users/${userId}`, {
    headers: { Authorization: `Bearer ${secretKey()}`, "User-Agent": "emergent-app" },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Clerk user lookup failed: ${r.status}`);
  return r.json();
}

function profileFromClerk(cu) {
  const admins = new Set((process.env.ADMIN_EMAIL || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
  const emails = cu.email_addresses || [];
  const isAdmin = emails.some((e) => admins.has(e.email_address.toLowerCase()) && (e.verification || {}).status === "verified");
  const primary = (emails.find((e) => e.id === cu.primary_email_address_id) || emails[0] || {}).email_address || "";
  const name = [cu.first_name, cu.last_name].filter(Boolean).join(" ") || primary.split("@")[0];
  return { profile: { email: primary, name }, isAdmin };
}

export async function currentMember(req, res, next) {
  const { user_id: uid } = await requireUser(req);
  const users = col("users");
  let member = await users.findOne({ user_id: uid }, { projection: { _id: 0 } });
  if (!member || !member.role) {
    const { profile, isAdmin } = profileFromClerk(await clerkUser(uid));
    const role = isAdmin ? "admin" : DEFAULT_ROLE;
    await users.updateOne({ user_id: uid, role: { $in: [null, ""] } }, { $set: { role } });
    member = await users.findOneAndUpdate(
      { user_id: uid },
      { $setOnInsert: { user_id: uid, role, phone: "", created_at: nowIso(), ...profile } },
      { upsert: true, projection: { _id: 0 }, returnDocument: "after" },
    );
  }
  if (member.env !== ENV) await users.updateOne({ user_id: uid }, { $set: { env: ENV } });
  req.member = { ...member, env: ENV, role: effectiveRole(member.role) };
  next();
}

export function requireRole(...roles) {
  return [currentMember, (req, res, next) => {
    if (!roles.includes(req.member.role)) throw new HttpError(403, "Not allowed");
    next();
  }];
}

export const driverProfile = (uid) => col("drivers").findOne({ user_id: uid }, { projection: { _id: 0 } });

export const currentDriver = [...requireRole("driver"), async (req, res, next) => {
  const d = await driverProfile(req.member.user_id);
  if (!d || d.status !== "approved") throw new HttpError(403, "Your driver account is not approved yet");
  req.member = { ...req.member, driver: d };
  next();
}];

export async function moveRetiredRoles() {
  for (const [oldRole, newRole] of Object.entries(RETIRED_ROLES)) {
    await col("users").updateMany({ role: oldRole }, { $set: { role: newRole } });
  }
}
