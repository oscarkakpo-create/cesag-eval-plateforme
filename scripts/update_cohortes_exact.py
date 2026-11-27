import json, re
from pathlib import Path

ROOT_DIR = Path(r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme")
catalog_path = ROOT_DIR / "public" / "data" / "catalog.json"
catalog_js_path = ROOT_DIR / "public" / "data" / "catalog.js"
docs_cat_json = ROOT_DIR / "docs" / "data" / "catalog.json"
docs_cat_js = ROOT_DIR / "docs" / "data" / "catalog.js"

cat = json.load(open(catalog_path, encoding="utf-8"))
courses_372 = cat.get("moodle_courses", [])

# Exact 46 Moodle cohortes in Cat 372
# Map each course_id to its exact Moodle fullname
MOODLE_COHORTES_BY_ID = {
    c["course_id"]: {
        "course_id": c["course_id"],
        "fullname": c["fullname"],
        "niveau": c["niveau"],
        "url": c.get("url", f"https://formations.cesagonline.com/course/view.php?id={c['course_id']}&section=1")
    }
    for c in courses_372 if c.get("course_id") != 1666
}

# Define clean exact mapping from program id/code to Moodle course IDs
PROGRAM_TO_COURSES = {
    # LICENCES
    "licence-lg-1": [1667], # Licence en Gestion - L1
    "licence-lg-2": [1672], # Licence en Gestion - L2
    "licence-lg-3-tbf": [1677], # Licence en Gestion - L3
    "licence-lg-3-egp": [1677],
    "licence-lg-3-grh": [1677],
    "licence-lg-3-mdc": [1677],
    "licence-lcca-1": [1668], # Licence en Comptabilité, Contrôle et Audit - L1
    "licence-lcca-2": [1673], # Licence en Comptabilité, Contrôle et Audit - L2
    "licence-lcca-3": [1678], # Licence en Comptabilité, Contrôle et Audit - L3
    "licence-ltcf": [1682], # Licence en Techniques Comptables et Financières 3e année
    "licence-lgeo": [1680], # Licence en Gestion des Entreprises et Organisations
    "licence-lg-pme-pmi": [1677], # LG3
    "licence-lgss": [1677], # LG3
    "licence-lsmd": [1671, 1676, 1681], # LSMD L1, L2, 3e année spéciale
    "licence-miage-l1": [1669], # MIAGE L1
    "licence-miage-l2": [1674], # MIAGE L2
    "licence-miage-l3": [1674], # MIAGE
    "licence-decogef": [1670, 1675, 1679], # DECOGEF L1, L2, L3

    # MASTERS
    "master-macg": [1683, 1707], # JOUR (1683) & SOIR (1707)
    "master-mcgf": [1684, 1708, 1692], # JOUR (1684), SOIR (1708), M2 (1692)
    "master-mcca": [1685, 1712, 1693, 1711], # JOUR (1685), SOIR (1712), M2 JOUR (1693), M2 SOIR (1711)
    "master-mdbfa": [1686, 1709, 1694], # JOUR (1686), SOIR (1709), M2 (1694)
    "master-mdbfa2-dbf": [1694], # M2
    "master-mdbfa2-itf": [1694], # M2
    "master-me3p": [1691], # ME3P
    "master-mgp": [1687, 1710], # JOUR (1687) & SOIR (1710)
    "master-mms": [1689], # MMS
    "master-mgrh": [1688], # MGRH
    "master-msmd-finance": [1690, 1695], # MSMD & M2
    "master-msmd-actuariat": [1690, 1695],
    "master-msmd-eco-appliquee": [1690, 1695],
    "master-mdgl": [1691], # Gouvernance / projets
    "master-mbf": [1696], # Banque et Finance
    "master-descogef": [1704, 1705, 1706], # DESCOGEF 1, 2, 2e année spéciale

    # MBA
    "mba-mba-ag-online": [1697], # MBA en Administration et Gestion
    "mba-mba-ag-executive": [1697],
    "mba-mba-acg-online": [1698], # MBA en Audit et Contrôle de Gestion
    "mba-mba-acg-executive": [1698],
    "mba-mba-gp-online": [1699], # MBA en Gestion des Projets
    "mba-mba-gp-executive": [1699],
    "mba-mba-msch": [1700], # MBA en Management Stratégique du Capital Humain
    "mba-mba-mpp": [1701], # MBA en Management de la Performance Publique
    "mba-mba-mss": [1702], # MBA en Management des Services de Santé
    "mba-mba-es": [1703], # MBA en Économie de la Santé
    "mba-mba-mee": [1697], # MBA
    "mba-mba-mcid": [1697],
    "mba-mba-igf": [1700],
    "mba-mba-fi": [1697],
    "mba-mba-mpa": [1701],
    "mba-mba-ms": [1697],
}

# Update programs in catalog
updated_programs = []
all_exact_cohortes = set()

for prog in cat.get("programs", []):
    pid = prog.get("id")
    c_ids = PROGRAM_TO_COURSES.get(pid, [])
    if not c_ids:
        # Fallback to level-matching
        c_ids = [c["course_id"] for c in courses_372 if c["niveau"] == prog.get("niveau")]
    
    # Get exact Moodle fullnames
    exact_cohortes = []
    for cid in c_ids:
        if cid in MOODLE_COHORTES_BY_ID:
            fname = MOODLE_COHORTES_BY_ID[cid]["fullname"]
            if fname not in exact_cohortes:
                exact_cohortes.append(fname)
                all_exact_cohortes.add(fname)
    
    prog["classes_suggerees"] = exact_cohortes
    prog["moodle_course_ids"] = c_ids
    prog["default_moodle_course_id"] = c_ids[0] if c_ids else None
    updated_programs.append(prog)

cat["programs"] = updated_programs
cat["classes_connues"] = sorted(list(all_exact_cohortes))

# Save JSON
with open(catalog_path, "w", encoding="utf-8") as f:
    json.dump(cat, f, indent=2, ensure_ascii=False)

# Save JS
js_content = f"// CESAG Catalog 2026-2027 (Catégorie 372)\nwindow.CESAG_CATALOG = {json.dumps(cat, ensure_ascii=False)};\n"
with open(catalog_js_path, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Updated {len(updated_programs)} programs with EXACT {len(all_exact_cohortes)} Moodle cohortes.")
print("Sample program classes_suggerees for MACG:", [p for p in updated_programs if p['code'] == 'MACG'][0]['classes_suggerees'])
print("Sample program classes_suggerees for LG 1:", [p for p in updated_programs if p['code'] == 'LG 1'][0]['classes_suggerees'])
