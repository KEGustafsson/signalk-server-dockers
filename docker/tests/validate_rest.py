import json
import sys
import time
import requests

BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/signalk/v1/api"
AUTH_BASE = f"{BASE_URL}/signalk/v1/auth"
WS_URL = "ws://localhost:3000/signalk/v1/stream"

ADMIN_USER = "admin"
ADMIN_PASS = "test123"

TEST_POSITION = {"latitude": 48.1173, "longitude": 11.5167}


def create_admin():
    """Create admin account via enableSecurity endpoint."""
    r = requests.post(
        f"{API_BASE}/enableSecurity",
        json={"userId": ADMIN_USER, "password": ADMIN_PASS},
        timeout=5,
    )
    if r.status_code in (200, 201, 202):
        return True
    print(f"  enableSecurity HTTP {r.status_code}: {r.text[:200]}")
    return False


def login():
    """Login and return JWT token."""
    r = requests.post(
        f"{AUTH_BASE}/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=5,
    )
    if r.status_code == 200:
        return r.json().get("token")
    print(f"  login HTTP {r.status_code}: {r.text[:200]}")
    return None


def send_position_delta(token):
    """Send test position data via WebSocket delta."""
    from websocket import create_connection

    ws = create_connection(f"{WS_URL}?subscribe=none&token={token}", timeout=10)
    hello = json.loads(ws.recv())
    print(f"  Connected (server: {hello.get('name', 'unknown')})")

    delta = {
        "context": "vessels.self",
        "updates": [
            {
                "source": {"label": "pre-release-test"},
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "values": [
                    {"path": "navigation.position", "value": TEST_POSITION}
                ],
            }
        ],
    }
    ws.send(json.dumps(delta))
    time.sleep(1)
    ws.close()
    return True


def validate_position(timeout=10):
    """Check position data via REST API."""
    url = f"{API_BASE}/vessels/self/navigation/position/value"
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(url, timeout=2)
            if r.status_code == 200:
                data = r.json()
                if data.get("latitude") is not None and data.get("longitude") is not None:
                    return data
        except Exception:
            pass
        time.sleep(0.5)
    return None


print("SignalK Pre-Release REST Validation")
print("=" * 40)

print("\n1. Creating admin account...")
if not create_admin():
    print("FAIL: Could not create admin account")
    sys.exit(1)
print("   OK")

print("\n2. Logging in...")
token = login()
if not token:
    print("FAIL: Could not login")
    sys.exit(1)
print("   OK")

print("\n3. Sending position delta via WebSocket...")
if not send_position_delta(token):
    print("FAIL: Could not send delta")
    sys.exit(1)
print("   OK")

print("\n4. Validating position via REST API...")
value = validate_position()
if not value:
    print("FAIL: Position not available in REST API")
    try:
        r = requests.get(f"{API_BASE}/vessels/self", timeout=5)
        print(f"  /vessels/self -> HTTP {r.status_code}")
        print(f"  {r.text[:500]}")
    except Exception as e:
        print(f"  /vessels/self -> {e}")
    sys.exit(1)

lat = value["latitude"]
lon = value["longitude"]
print(f"   Position: lat={lat}, lon={lon}")

if abs(lat - TEST_POSITION["latitude"]) > 0.001 or abs(lon - TEST_POSITION["longitude"]) > 0.001:
    print(f"FAIL: Position mismatch (expected {TEST_POSITION})")
    sys.exit(1)

print("\nREST validation PASSED")
