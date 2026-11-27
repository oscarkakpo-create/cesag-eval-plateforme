import json
data = json.load(open(r"C:\Users\Digi Face\.gemini\antigravity\scratch\moodle_courses_cat372.json", encoding="utf-8"))
print(f"Total courses: {len(data)}")
for c in data:
    print(f"ID {c.get('course_id')}: {c.get('course_name')}")
