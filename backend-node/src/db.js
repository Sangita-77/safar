import { MongoClient } from "mongodb";

export const nowIso = () => new Date().toISOString().replace("Z", "+00:00");

let mongoClient = null;
let activeDb = null;

export const client = {
  async connect() {
    const url = (process.env.MONGO_URL || "").trim();
    const dbName = (process.env.DB_NAME || "safar").trim();
    if (!url) {
      throw new Error("MONGO_URL is not set in backend-node/.env");
    }
    mongoClient = new MongoClient(url, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    await mongoClient.connect();
    activeDb = mongoClient.db(dbName);
    await activeDb.command({ ping: 1 });
    console.log(`Connected to MongoDB database "${dbName}"`);
  },
  async close() {
    if (mongoClient) await mongoClient.close();
  },
};

export const col = (name) => {
  if (!activeDb) {
    throw new Error("Database is not connected yet. Call client.connect() first.");
  }
  return activeDb.collection(name);
};

const INDEXES = {
  users: [
    { key: { user_id: 1 }, name: "user_id", unique: true },
    { key: { email: 1 }, name: "email" },
    { key: { role: 1 }, name: "role" },
  ],
  drivers: [
    { key: { user_id: 1 }, name: "user_id", unique: true },
    { key: { status: 1, online: 1 }, name: "status_online" },
  ],
  fares: [{ key: { key: 1 }, name: "key", unique: true }],
  bookings: [
    { key: { id: 1 }, name: "id", unique: true },
    { key: { customer_id: 1, created_at: -1 }, name: "customer" },
    { key: { driver_id: 1, created_at: -1 }, name: "driver" },
    { key: { status: 1, vehicle: 1 }, name: "status_vehicle" },
    { key: { created_at: -1 }, name: "created_desc" },
  ],
};

export async function ensureIndexes() {
  for (const [name, models] of Object.entries(INDEXES)) {
    for (const m of models) {
      try {
        await col(name).createIndexes([m]);
      } catch (e) {
        console.error(`ensure_indexes(${name}.${m.name}): ${e.message}`);
      }
    }
  }
}
