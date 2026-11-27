#!/usr/bin/env python3
"""Generate Google Sheets batch JSON for seeding Declarations & Synthese_KPI."""

from __future__ import annotations

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DECL_PATH = ROOT_DIR / "data" / "declarations.json"
BATCH_OUT = Path(
    r"C:\Users\Digi Face\.gemini\antigravity\brain\db2533f0-742a-4efc-8e00-648252483692\scratch\gsheet_batch.json"
)

HEADERS = [
    "id",
    "statut",
    "niveau",
    "programme",
    "semestre",
    "classe",
    "code_ecue",
    "module",
    "intervenant",
    "email_intervenant",
    "date_fin_module",
    "declarant_nom",
    "declarant_email",
    "cmid",
    "moodle_course_id",
    "lien_moodle",
    "date_ouverture",
    "date_cloture",
    "nb_repondants",
    "observations",
    "source",
    "created_at",
    "updated_at",
]


def main() -> None:
    BATCH_OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(DECL_PATH, "r", encoding="utf-8") as f:
        items = json.load(f)

    rows = [HEADERS]
    for item in items:
        rows.append(["" if item.get(h) is None else item.get(h) for h in HEADERS])

    kpi_rows = [
        ["SYNTHÈSE SUIVI-ÉVALUATION CESAG 2026-2027", "", "", "", ""],
        ["Indicateur global", "Valeur", "", "", ""],
        ["Total déclarations", "=MAX(0;COUNTA(Declarations!A2:A))", "", "", ""],
        [
            "Déclarations actives",
            '=COUNTIF(Declarations!B2:B;"A_programmer")+COUNTIF(Declarations!B2:B;"Programmee")+COUNTIF(Declarations!B2:B;"Realisee")',
            "",
            "",
            "",
        ],
        ["À programmer sur Moodle", '=COUNTIF(Declarations!B2:B;"A_programmer")', "", "", ""],
        ["Programmées / Ouvertes", '=COUNTIF(Declarations!B2:B;"Programmee")', "", "", ""],
        ["Réalisées / Clôturées", '=COUNTIF(Declarations!B2:B;"Realisee")', "", "", ""],
        ["Taux de programmation (%)", "=IFERROR(ROUND((B6+B7)/B4*100;1);0)", "", "", ""],
        ["Taux de réalisation (%)", "=IFERROR(ROUND(B7/B4*100;1);0)", "", "", ""],
        ["Total répondants enregistrés", "=SUM(Declarations!S2:S)", "", "", ""],
        ["", "", "", "", ""],
        ["Niveau", "Total", "À programmer", "Programmées", "Réalisées"],
        [
            "Licence",
            '=COUNTIF(Declarations!C2:C;"Licence")',
            '=COUNTIFS(Declarations!C2:C;"Licence";Declarations!B2:B;"A_programmer")',
            '=COUNTIFS(Declarations!C2:C;"Licence";Declarations!B2:B;"Programmee")',
            '=COUNTIFS(Declarations!C2:C;"Licence";Declarations!B2:B;"Realisee")',
        ],
        [
            "Master",
            '=COUNTIF(Declarations!C2:C;"Master")',
            '=COUNTIFS(Declarations!C2:C;"Master";Declarations!B2:B;"A_programmer")',
            '=COUNTIFS(Declarations!C2:C;"Master";Declarations!B2:B;"Programmee")',
            '=COUNTIFS(Declarations!C2:C;"Master";Declarations!B2:B;"Realisee")',
        ],
        [
            "MBA",
            '=COUNTIF(Declarations!C2:C;"MBA")',
            '=COUNTIFS(Declarations!C2:C;"MBA";Declarations!B2:B;"A_programmer")',
            '=COUNTIFS(Declarations!C2:C;"MBA";Declarations!B2:B;"Programmee")',
            '=COUNTIFS(Declarations!C2:C;"MBA";Declarations!B2:B;"Realisee")',
        ],
    ]

    batch = [
        {"op": "write", "range": f"Declarations!A1:W{len(rows)}", "data": rows},
        {"op": "write", "range": "Synthese_KPI!A1:E15", "data": kpi_rows},
    ]
    with open(BATCH_OUT, "w", encoding="utf-8") as f:
        json.dump(batch, f, ensure_ascii=False, indent=2)
    print(f"Batch written: {BATCH_OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
