import requests
import sys
import time

BASE = "http://localhost:3000/signalk/v1/api"

def wait_for_vessel(timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        r = requests.get(f"{BASE}/vessels", timeout=2)
        if r.status_code == 200 and r.json():
            return next(iter(r.json().keys()))
        time.sleep(1)
    return None

print("Waiting for vessel...")
vessel_id = wait_for_vessel()

if not vessel_id:
    print("ERROR: No vessel created")
    sys.exit(1)

print("Using vessel:", vessel_id)

# --- THIS IS THE CRITICAL CHANGE ---
url = f"{BASE}/vessels/{vessel_id}/navigation/position"

print("Querying:", url)
r = requests.get(url, timeout=5)

if r.status_code != 200:
    print("ERROR: position endpoint not available")
    sys.exit(1)

data = r.json()
value = data.get("value")

if not value:
    print("ERROR: position value missing")
    print("Response:", data)
    sys.exit(1)

lat = value.get("latitude")
lon = value.get("longitude")

if lat is None or lon is None:
    print("ERROR: latitude/longitude missing")
    print("Value:", value)
    sys.exit(1)

print(f"Position OK: lat={lat}, lon={lon}")
print("REST validation PASSED")
