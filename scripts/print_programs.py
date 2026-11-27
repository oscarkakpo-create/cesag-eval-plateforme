import json
cat = json.load(open(r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\public\data\catalog.json", encoding="utf-8"))
for p in cat.get("programs", []):
    print(f"[{p.get('niveau')}] Code: '{p.get('code')}' | Titre: '{p.get('titre')}'")
