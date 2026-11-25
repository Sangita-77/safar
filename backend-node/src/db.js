import { MongoClient } from "mongodb";

export const client = new MongoClient(process.env.MONGO_URL);
export const db = client.db(process.env.DB_NAME);
export const col = (name) => db.collection(name);

const INDEXES = {
  users: [{ key: { user_id: 1 }, name: "user_id", unique: true }, { key: { role: 1 }, name: "role" }],
  drivers: [{ key: { user_id: 1 }, name: "user_id", unique: true }, { key: { status: 1, online: 1 }, name: "status_online" }],
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

export const nowIso = () => new Date().toISOString().replace("Z", "+00:00");
