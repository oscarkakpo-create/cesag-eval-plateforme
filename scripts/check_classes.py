import json

cat = json.load(open(r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\public\data\catalog.json", encoding="utf-8"))
courses = cat.get("moodle_courses", [])
programs = cat.get("programs", [])

print(f"Total Moodle courses: {len(courses)}")
print(f"Total programs: {len(programs)}")

# Let's inspect all classes_suggerees across programs
all_classes = set()
for p in programs:
    for cls in p.get("classes_suggerees", []):
        all_classes.add(cls)

print("Total distinct classes_suggerees:", len(all_classes))
print("Sample classes_suggerees:", sorted(list(all_classes))[:25])
