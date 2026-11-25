import os, json, sys, urllib.request
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
SK = os.environ["CLERK_SECRET_KEY"]


def bapi(path, body=None, method="POST"):
    req = urllib.request.Request("https://api.clerk.com/v1" + path, data=json.dumps(body).encode() if body is not None else None,
                                 method=method, headers={"Authorization": "Bearer " + SK, "Content-Type": "application/json", "User-Agent": "emergent-test"})
    return json.load(urllib.request.urlopen(req))


db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
PEOPLE = [("safar.admin+clerk_test@example.com", "TEST Asha Admin", "admin"),
          ("safar.driver+clerk_test@example.com", "TEST Ravi Kumar", "driver"),
          ("safar.customer+clerk_test@example.com", "TEST Priya Sharma", "customer")]
out = {}
for email, name, role in PEOPLE:
    found = bapi(f"/users?email_address={urllib.parse.quote(email)}", method="GET") if True else []
    if found:
        u = found[0]
    else:
        u = bapi("/users", {"email_address": [email], "password": "Safar-Test-2026!", "skip_password_checks": True})
    db.users.update_one({"user_id": u["id"]}, {"$set": {"role": role, "env": "preview", "email": email, "name": name, "phone": "9876543210"},
                                               "$setOnInsert": {"created_at": "2026-11-25T00:00:00+00:00"}}, upsert=True)
    if role == "driver":
        db.drivers.update_one({"user_id": u["id"]}, {"$set": {
            "vehicle_type": "car", "vehicle_model": "Maruti Dzire", "vehicle_number": "DL01AB1234", "license_number": "DL0420110012345",
            "phone": "9876543210", "city": "New Delhi", "status": "approved", "name": name, "email": email, "applied_at": "2026-11-25T00:00:00+00:00", "env": "preview"},
            "$setOnInsert": {"online": False, "rating": None, "ratings_count": 0, "location": None}}, upsert=True)
    out[role] = u["id"]
if len(sys.argv) > 1:
    role = sys.argv[1]
    s = bapi("/sessions", {"user_id": out[role]})
    print(bapi(f"/sessions/{s['id']}/tokens", {"expires_in_seconds": 3600})["jwt"])
else:
    print(json.dumps(out))
