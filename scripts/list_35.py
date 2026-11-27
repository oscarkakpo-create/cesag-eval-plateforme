import json

with open(r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\data\declarations_archive_test.json", encoding="utf-8") as f:
    items = json.load(f)

print(f"Total: {len(items)}")
for x in items:
    cid = x.get("id")
    cls = x.get("classe")
    mod = x.get("module")
    prof = x.get("intervenant")
    st = x.get("statut")
    cmid = x.get("cmid")
    print(f"{cid} - {cls} - {mod} - {prof} - {st} - CMID:{cmid}")
