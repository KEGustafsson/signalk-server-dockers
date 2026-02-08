import json
import requests
import sys

URL = "http://localhost:3000/signalk/v1/api/vessels/self"

expected = json.load(open("testdata/expected.json"))
response = requests.get(URL)

if response.status_code != 200:
    print("REST API not responding")
    sys.exit(1)

actual = response.json()

def check(expected, actual, path=""):
    for key, value in expected.items():
        if key not in actual:
            print(f"Missing {path}/{key}")
            return False
        if isinstance(value, dict):
            if not check(value, actual[key], f"{path}/{key}"):
                return False
        else:
            if abs(actual[key] - value) > 0.01:
                print(f"Mismatch {path}/{key}")
                return False
    return True

if not check(expected, actual):
    sys.exit(1)

print("REST validation OK")
