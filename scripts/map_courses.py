import json
from pathlib import Path

ROOT_DIR = Path(r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme")
moodle_courses_file = ROOT_DIR.parent / "moodle_courses_cat372.json"
catalog_file = ROOT_DIR / "public" / "data" / "catalog.json"

cat = json.load(open(catalog_file, encoding="utf-8"))
courses_372 = json.load(open(moodle_courses_file, encoding="utf-8"))

programs = cat.get("programs", [])
print(f"Catalog has {len(programs)} programs and {len(courses_372)} Moodle courses in Cat 372.")

for c in courses_372:
    cid = c.get("course_id")
    cname = c.get("course_name")
    if cid == "1666": # template
        continue
    # find matching program
    matches = []
    for p in programs:
        # compare codes or titles
        p_code = p.get("code", "").lower()
        p_titre = p.get("titre", "").lower()
        cn_low = cname.lower()
        
        # simple heuristic
        if p_code in cn_low or p_titre in cn_low:
            matches.append(p.get("code"))
    print(f"Course {cid} | '{cname}' -> Matches: {matches[:3]}")
