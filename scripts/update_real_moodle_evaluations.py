import datetime
import json

moodle_stats = [
  { "cmid": 31273, "nb_repondants": 23, "visible": "Visible" },
  { "cmid": 31280, "nb_repondants": 26, "visible": "Visible" },
  { "cmid": 31283, "nb_repondants": 22, "visible": "Visible" },
  { "cmid": 31285, "nb_repondants": 21, "visible": "Visible" },
  { "cmid": 31278, "nb_repondants": 22, "visible": "Visible" },
  { "cmid": 31298, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31299, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31300, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31301, "nb_repondants": 5, "visible": "Visible" },
  { "cmid": 31302, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31799, "nb_repondants": 2, "visible": "Visible" },
  { "cmid": 31798, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31797, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31796, "nb_repondants": 1, "visible": "Visible" },
  { "cmid": 31354, "nb_repondants": 40, "visible": "Visible" },
  { "cmid": 31355, "nb_repondants": 29, "visible": "Visible" },
  { "cmid": 31356, "nb_repondants": 23, "visible": "Visible" },
  { "cmid": 31358, "nb_repondants": 19, "visible": "Visible" },
  { "cmid": 31360, "nb_repondants": 21, "visible": "Visible" },
  { "cmid": 31659, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31660, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31662, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31663, "nb_repondants": 0, "visible": "Visible" },
  { "cmid": 31311, "nb_repondants": 32, "visible": "Visible" },
  { "cmid": 31312, "nb_repondants": 22, "visible": "Visible" },
  { "cmid": 31318, "nb_repondants": 33, "visible": "Visible" },
  { "cmid": 31322, "nb_repondants": 46, "visible": "Visible" },
  { "cmid": 31613, "nb_repondants": 8, "visible": "Visible" },
  { "cmid": 31614, "nb_repondants": 8, "visible": "Visible" },
  { "cmid": 31615, "nb_repondants": 4, "visible": "Visible" },
  { "cmid": 31616, "nb_repondants": 7, "visible": "Visible" },
  { "cmid": 31621, "nb_repondants": 7, "visible": "Visible" },
  { "cmid": 31384, "nb_repondants": 36, "visible": "Visible" },
  { "cmid": 31392, "nb_repondants": 42, "visible": "Visible" },
  { "cmid": 31393, "nb_repondants": 40, "visible": "Visible" }
]

reps_map = {str(x["cmid"]): x["nb_repondants"] for x in moodle_stats}

archive_path = r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\data\declarations_archive_test.json"
with open(archive_path, "r", encoding="utf-8") as f:
    items = json.load(f)

# Règle de clôture : « Clôturé » (Realisee) seulement quand la date de clôture du
# feedback est passée. Le nombre de réponses est une simple information : un
# feedback qui a déjà des réponses peut rester ouvert.
today = datetime.date.today().isoformat()

for item in items:
    cmid = str(item.get("cmid", ""))
    if cmid in reps_map:
        item["nb_repondants"] = reps_map[cmid]
        close = str(item.get("date_cloture") or "")[:10]
        if close and close < today:
            item["statut"] = "Realisee"
        elif item.get("statut") in ("Programmee", "Realisee"):
            item["statut"] = "Programmee"

total_reps = sum(x.get("nb_repondants", 0) for x in items)
print(f"Updated {len(items)} items. Total real responses: {total_reps}")

# Write to active declarations.json
decl_path = r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\data\declarations.json"
with open(decl_path, "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

print("Saved active data/declarations.json")
