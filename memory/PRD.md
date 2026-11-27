# Safar — PRD

## Original problem statement
"Build a mobile app: create a proffesional app like indian ubar (rent car , rent bike , rent e-rikshaw , curior etc) .. user these technology - react native , node js , mongo"
User choices: open as Link (PWA); users = customer, driver and super admin; Email and Password Login; payments Razorpay + cash on delivery; services: Car rides, Bike rides, E-rickshaw rides, Courier/parcel, Hourly vehicle rental; "do it professionally", "make it compatible with real world and a professional app". Admin email: user said "create demo" (no email given yet). Razorpay keys: skipped.

## Architecture
- Backend (2026-11-25 rewrite, same logic): Node.js in /app/backend-node (Express 5, mongodb driver, jose for Clerk JWT, zod validation, razorpay). In preview, /app/backend/server.py only starts Node on 127.0.0.1:8002 and forwards /api (supervisor is fixed to uvicorn on 7200). Emergent publishing does not support Node backends; user will self-host (see backend-node/README.md).
- Frontend: React (CRA) mobile-first PWA (manifest, sw.js, icons), Tailwind + shadcn, react-query, Leaflet + OpenStreetMap tiles, Clerk components.
- Backend: FastAPI (server.py) + MongoDB (motor). Emergent-managed Clerk auth (clerk_auth.py). Roles in db.users (admin/driver/customer), ADMIN_EMAIL for first admin.
- Geo: Nominatim proxy (/api/geo/search, /api/geo/reverse), distance = haversine × 1.3.
- Payments: Razorpay order + signature verify (inactive until RAZORPAY_KEY_ID/SECRET set); cash marked paid on completion.
- Note: user asked for React Native + Node; platform builds React web (PWA) + FastAPI + MongoDB.

## Personas
Customer (books rides/parcels/rentals), Driver partner (applies, gets approved, accepts trips), Super admin (approves drivers, pricing, bookings, users).

## Core requirements
Multi-service booking with upfront INR fares, driver dispatch by vehicle type, OTP trip start, live trip status + driver location, ratings, driver earnings (80%), admin dashboard/pricing/driver approval/roles.

## Implemented (2026-11-25)
- Landing, sign-in/up (Clerk), customer home, booking (ride/parcel/rental), trip page with map, OTP, cancel, rating, online pay button
- Driver apply → admin approve; online toggle, requests, accept/arrived/start(OTP, 5-attempt limit)/complete/release trip; earnings
- Admin overview stats/chart, drivers, bookings filters, pricing editor, users & roles
- Auto-cancel searching bookings after 30 min; query cache cleared on user change
- PWA manifest/sw/icons
- Backend rewritten in Node.js with identical routes/logic; drivers can no longer re-accept a trip they released (OTP-limit bypass fix); preview proxy keeps no cookies
- User guide PDF: /docs/Safar_User_Guide.pdf (generator /app/scripts/build_user_guide.py)

## Backlog
- P0: Set ADMIN_EMAIL (user's email) for real super admin; add Razorpay keys to enable UPI/card
- P1: Road-distance routing (OSRM/Google), service-area radius for driver requests, payment retry/webhook reconciliation, revenue counting only paid trips, rental pricing minimum clarity, fare lock between estimate and booking
- P2: Map tap-to-pick location, Nominatim global rate limit, push notifications, SOS/share trip, promo codes, store app
