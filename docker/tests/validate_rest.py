import json
import requests
import sys
import time

BASE = "http://localhost:3000/signalk/v1/api"

def wait_for_vessels(timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(f"{BASE}/vessels", timeout=2)
            if r.status_code == 200 and r.json():
                return r.json()
        except Exception:
            pass
        time.sleep(1)
    return None

print("Waiting for vessels data...")
vessels = wait_for_vessels()

if not vessels:
    print("ERROR: No vessels data after timeout")
    sys.exit(1)

print("Vessels detected:", list(vessels.keys()))

# Prefer self if present, otherwise first vessel
self_id = "self" if "self" in vessels else next(iter(vessels))
nav = vessels[self_id].get("navigation")

if not nav or "position" not in nav:
    print("ERROR: Navigation position missing")
    sys.exit(1)

pos = nav["position"]
print("Position OK:", pos)
print("REST validation PASSED")
