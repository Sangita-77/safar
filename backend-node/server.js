import "./src/env.js";
import express from "express";
import cors from "cors";
import { client, col, ensureIndexes } from "./src/db.js";
import { clerkRouter } from "./src/clerk.js";
import { moveRetiredRoles } from "./src/roles.js";
import { seedFares } from "./src/fares.js";
import { HttpError } from "./src/util.js";
import { router as general } from "./src/routes/general.js";
import { router as bookings } from "./src/routes/bookings.js";
import { router as driver } from "./src/routes/driver.js";
import { router as payments } from "./src/routes/payments.js";
import { router as admin } from "./src/routes/admin.js";

const app = express();
app.disable("x-powered-by");
app.set("etag", false);
app.set("trust proxy", true);

const origins = (process.env.CORS_ORIGINS || "*").split(",").map((o) => o.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins, credentials: true }));

app.use("/api", (req, res, next) => {
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Clerk relay needs the raw body, so it is mounted before the JSON parser.
app.use("/api", clerkRouter);
app.use(express.json({ limit: "1mb" }));
app.use("/api", general, bookings, driver, payments, admin);

app.use("/api", (req, res) => res.status(404).json({ detail: "Not Found" }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ detail: err.detail });
  if (err.type === "entity.parse.failed") return res.status(422).json({ detail: [{ loc: ["body"], msg: "Invalid JSON body", type: "json_invalid" }] });
  console.error(err);
  res.status(500).json({ detail: "Internal Server Error" });
});

const port = Number(process.env.PORT || 7200);
const host = process.env.HOST || "0.0.0.0";

await client.connect();
await col("users").deleteMany({ user_id: /^demo_/ });
await col("drivers").deleteMany({ user_id: /^demo_/ });
await seedFares();
await moveRetiredRoles();
ensureIndexes();

const server = app.listen(port, host, () => console.log(`Safar API (Node.js) listening on ${host}:${port}`));

const shutdown = () => server.close(() => client.close().finally(() => process.exit(0)));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
