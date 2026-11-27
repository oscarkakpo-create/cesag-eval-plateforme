import json
import requests

GAS_URL = "https://script.google.com/macros/s/AKfycby1yAOXqwF9fQCuy13cTzi06L-rD6zJIcW3f9BpXdbJGM3xnQxcuyb6PWPMRv1Pu2OPpA/exec"

with open(r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\data\declarations.json", "r", encoding="utf-8") as f:
    items = json.load(f)

print(f"Preparing to upload {len(items)} real evaluations to Google Sheet...")

# First check existing
res = requests.get(GAS_URL + "?action=list")
existing = res.json().get("declarations", [])
print(f"Existing in Google Sheet: {len(existing)}")

# Delete the single test item if present
for x in existing:
    if x.get("id") == "EVAL-2627-0001" and "Test" in str(x):
        requests.post(GAS_URL, json={"action": "delete", "id": x["id"]}, headers={"Content-Type": "text/plain;charset=utf-8"})

# Upload in batches of 10
for i in range(0, len(items), 10):
    batch = items[i:i+10]
    payload = {
        "action": "submit",
        "items": batch,
        "force": True
    }
    resp = requests.post(GAS_URL, json=payload, headers={"Content-Type": "text/plain;charset=utf-8"})
    print(f"Uploaded batch {i}..{i+len(batch)}: {resp.status_code} - {resp.text[:120]}")

# Final verify
res = requests.get(GAS_URL + "?action=list")
final_items = res.json().get("declarations", [])
print(f"Final total in Google Sheet: {len(final_items)}")
