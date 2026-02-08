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

vessel_id = next(iter(vessels))
vessel = vessels[vessel_id]

print(f"Using vessel: {vessel_id}")

nav = vessel.get("navigation", {})
pos = nav.get("position", {})

value = pos.get("value")

if not value:
    print("ERROR: navigation.position.value missing")
    print("navigation object:", nav)
    sys.exit(1)

lat = value.get("latitude")
lon = value.get("longitude")

if lat is None or lon is None:
    print("ERROR: latitude/longitude missing")
    print("position.value:", value)
    sys.exit(1)

print(f"Position OK: lat={lat}, lon={lon}")
print("REST validation PASSED")
