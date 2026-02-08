import requests
import sys
import time

BASE = "http://localhost:3000/signalk/v1/api"

def wait_for_position(timeout=30):
    """Wait until position data is available from the self vessel."""
    url = f"{BASE}/vessels/self/navigation/position/value"
    start = time.time()
    attempt = 0
    while time.time() - start < timeout:
        attempt += 1
        try:
            r = requests.get(url, timeout=2)
            if r.status_code == 200:
                data = r.json()
                if data.get("latitude") is not None and data.get("longitude") is not None:
                    return data
                print(f"  attempt {attempt}: got 200 but position incomplete: {data}")
            else:
                print(f"  attempt {attempt}: HTTP {r.status_code}")
        except requests.ConnectionError:
            print(f"  attempt {attempt}: connection refused")
        except Exception as e:
            print(f"  attempt {attempt}: {e}")
        time.sleep(1)
    return None

print("Waiting for position data from self vessel...")
value = wait_for_position()

if not value:
    print("ERROR: No position data received within timeout")
    print()
    print("--- Diagnostic info ---")
    try:
        r = requests.get(f"{BASE}/vessels/self", timeout=5)
        print(f"GET /vessels/self -> HTTP {r.status_code}")
        print(r.text[:500])
    except Exception as e:
        print(f"GET /vessels/self -> {e}")
    sys.exit(1)

lat = value.get("latitude")
lon = value.get("longitude")

print(f"Position OK: lat={lat}, lon={lon}")
print("REST validation PASSED")
