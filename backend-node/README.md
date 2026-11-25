# Safar backend (Node.js)

Express 5 + MongoDB driver + Clerk (session JWT check) + Razorpay. Same API as before: every route is under `/api`.

## Run
```
yarn install
node server.js        # or: yarn dev (auto-restart on changes)
```

## Environment variables
| Name | Purpose |
|---|---|
| MONGO_URL, DB_NAME | MongoDB connection |
| PORT (default 8001), HOST (default 0.0.0.0) | Where the API listens |
| CORS_ORIGINS | Allowed frontend origins, comma separated (`*` = all) |
| CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY | Login (Clerk) |
| ADMIN_EMAIL | Email(s) that become super admin on first sign-in |
| RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET | Online payments (optional; cash works without) |

Variables are read from the process environment first, then `../backend/.env`, then `./.env` (set `ENV_FILE` to use another file).
The frontend talks to it through `REACT_APP_BACKEND_URL`.

## Layout
- `server.js` - app setup, error handling, startup (fare seeding, indexes)
- `src/clerk.js` - `/api/clerk/config`, production Clerk relay `/api/__clerk/*`, session verification
- `src/roles.js` - roles (admin / driver / customer), current user, permission checks
- `src/fares.js` - default fares, distance and fare calculation
- `src/routes/` - general (fares, geo, profile), bookings, driver, payments, admin

Note: in the Emergent preview, `backend/server.py` only starts this Node server and forwards `/api` to it; it contains no app logic.
