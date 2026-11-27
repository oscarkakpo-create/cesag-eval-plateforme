import json
cat = json.load(open(r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\public\data\catalog.json", encoding="utf-8"))
print("Total programs:", len(cat.get("programs", [])))
print("Total moodle_courses:", len(cat.get("moodle_courses", [])))
print("Total classes_connues:", len(cat.get("classes_connues", [])))
p0 = cat.get("programs", [])[0]
print("Program 0:", json.dumps({k: p0[k] for k in p0 if k != 'ecues'}, indent=2, ensure_ascii=False))
print("Sample classes_connues:", cat.get("classes_connues", [])[:10])
