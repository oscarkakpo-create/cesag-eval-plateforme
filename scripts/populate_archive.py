import json, subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DECL_PATH = ROOT_DIR / "data" / "declarations.json"

HEADERS = [
    "id", "statut", "niveau", "programme", "semestre", "classe", "code_ecue",
    "module", "intervenant", "email_intervenant", "date_fin_module",
    "declarant_nom", "declarant_email", "cmid", "moodle_course_id",
    "lien_moodle", "date_ouverture", "date_cloture", "nb_repondants",
    "observations", "source", "created_at", "updated_at"
]

with open(DECL_PATH, "r", encoding="utf-8") as f:
    items = json.load(f)

rows = [HEADERS]
for item in items:
    rows.append([str(item.get(k, "") or "") for k in HEADERS])

batch_payload = [
    {
        "op": "write",
        "range": f"Archive_Test_Pilote!A1:W{len(rows)}",
        "data": rows
    }
]

batch_file = r"C:\Users\Digi Face\.gemini\antigravity\brain\db2533f0-742a-4efc-8e00-648252483692\scratch\archive_batch_correct.json"
with open(batch_file, "w", encoding="utf-8") as f:
    json.dump(batch_payload, f, ensure_ascii=False)

res = subprocess.run(
    f'gsheets mutate batch 1PVRpET7yYune0RlTYf6YBOw2IfFEP-DU5dsDqEAo5Rs -f "{batch_file}"',
    shell=True,
    capture_output=True,
    text=True
)
print("Populated Archive_Test_Pilote:", res.stdout, res.stderr)
