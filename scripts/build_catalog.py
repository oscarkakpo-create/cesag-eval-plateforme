#!/usr/bin/env python3
"""Parse the 3 official CESAG plaquettes workbooks and build catalog + initial pilot seed."""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

import openpyxl

ROOT_DIR = Path(__file__).resolve().parent.parent
PLAQUETTES_DIR = ROOT_DIR / "data" / "plaquettes"
DATA_DIR = ROOT_DIR / "data"
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"

PILOT_EXCEL = Path(
    r"C:\Users\Digi Face\.gemini\antigravity\brain\78f4bbcb-ac0d-407d-a393-54a10e5ad3cc\EVALUATIONS_PROGRAMMEES_AVEC_LIENS.xlsx"
)

SKIP_SHEETS = {
    "Page de garde",
    "Sommaire",
    "Synthèse",
    "Contrôles",
    "Répartition TPE",
    "Cours déroulés",
}

WORKBOOKS = [
    (
        "Licence",
        "PLAQUETTES_LICENCES_CESAG_2025-2026_9_version finale_20260910.xlsx",
    ),
    (
        "Master",
        "PLAQUETTES_MASTERS_CESAG_2025-2026_2_20260908.xlsx",
    ),
    (
        "MBA",
        "PLAQUETTES_MBA_CESAG_2025-2026_1_20260908.xlsx",
    ),
]

# Verified Category 372 courses observed live on formations.cesagonline.com
MOODLE_COURSES_372 = [
    # LICENCE 1 (376)
    {"course_id": 1667, "classe": "LG 1", "fullname": "Licence en Gestion - L1", "niveau": "Licence", "subcat_id": 376, "total_feedbacks": 36},
    {"course_id": 1668, "classe": "LCCA 1", "fullname": "Licence en Comptabilité, Contrôle et Audit - L1", "niveau": "Licence", "subcat_id": 376, "total_feedbacks": 36},
    {"course_id": 1669, "classe": "MIAGE 1", "fullname": "Licence en Méthodes Informatiques Appliquées à la Gestion des Entreprises - L1", "niveau": "Licence", "subcat_id": 376, "total_feedbacks": 36},
    {"course_id": 1670, "classe": "DECOGEF 1", "fullname": "Diplôme d’Études de Comptabilité et Gestion Financière - L1", "niveau": "Licence", "subcat_id": 376, "total_feedbacks": 36},
    {"course_id": 1671, "classe": "LSMD 1", "fullname": "Licence en Sciences du Management et de la Décision - L1", "niveau": "Licence", "subcat_id": 376, "total_feedbacks": 36},
    # LICENCE 2 (377)
    {"course_id": 1672, "classe": "LG 2", "fullname": "Licence en Gestion - L2", "niveau": "Licence", "subcat_id": 377, "total_feedbacks": 36},
    {"course_id": 1673, "classe": "LCCA 2", "fullname": "Licence en Comptabilité, Contrôle et Audit - L2", "niveau": "Licence", "subcat_id": 377, "total_feedbacks": 36},
    {"course_id": 1674, "classe": "MIAGE 2", "fullname": "Licence en Méthodes Informatiques Appliquées à la Gestion des Entreprises - L2", "niveau": "Licence", "subcat_id": 377, "total_feedbacks": 36},
    {"course_id": 1675, "classe": "DECOGEF 2", "fullname": "Diplôme d’Études de Comptabilité et Gestion Financière - L2", "niveau": "Licence", "subcat_id": 377, "total_feedbacks": 36},
    {"course_id": 1676, "classe": "LSMD 2", "fullname": "Licence en Sciences du Management et de la Décision - L2", "niveau": "Licence", "subcat_id": 377, "total_feedbacks": 36},
    # LICENCE 3 (378)
    {"course_id": 1677, "classe": "LG 3", "fullname": "Licence en Gestion - L3", "niveau": "Licence", "subcat_id": 378, "total_feedbacks": 36},
    {"course_id": 1678, "classe": "LCCA 3", "fullname": "Licence en Comptabilité, Contrôle et Audit - L3", "niveau": "Licence", "subcat_id": 378, "total_feedbacks": 36},
    {"course_id": 1679, "classe": "DECOGEF 3", "fullname": "Diplôme d’Études de Comptabilité et Gestion Financière - L3", "niveau": "Licence", "subcat_id": 378, "total_feedbacks": 36},
    {"course_id": 1680, "classe": "LGEO", "fullname": "Licence en Gestion des Entreprises et Organisations", "niveau": "Licence", "subcat_id": 378, "total_feedbacks": 36},
    {"course_id": 1681, "classe": "LSMD 3", "fullname": "Licence en Sciences du Management et de la Décision 3e année spéciale", "niveau": "Licence", "subcat_id": 378, "total_feedbacks": 36},
    {"course_id": 1682, "classe": "LTCF", "fullname": "Licence en Techniques Comptables et Financières 3e année", "niveau": "Licence", "subcat_id": 378, "total_feedbacks": 36},
    # MASTER 1 (379)
    {"course_id": 1683, "classe": "MACG 1 Jour", "fullname": "Master en Audit et Contrôle de Gestion - JOUR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1684, "classe": "MCGF 1 Jour", "fullname": "Master en Comptabilité et Gestion Financière - JOUR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1685, "classe": "MCCA 1 Jour", "fullname": "Master en Comptabilité, Contrôle et Audit - JOUR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 39},
    {"course_id": 1686, "classe": "MDBFA 1 Jour", "fullname": "Master en Droit, Banque, Finance, Assurance - JOUR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1687, "classe": "MGP 1 Jour", "fullname": "Master en Gestion des Projets - JOUR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1688, "classe": "MGRH 1", "fullname": "Master en Gestion des Ressources Humaines", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1689, "classe": "MMS 1", "fullname": "Master en Marketing et Stratégie", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1690, "classe": "MSMD 1", "fullname": "Master en Sciences du Management et de la Décision", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1691, "classe": "ME3P", "fullname": "Master en Évaluation des Projets, Programmes et Politiques", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1707, "classe": "MACG 1 Soir", "fullname": "Master en Audit et Contrôle de Gestion - SOIR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1708, "classe": "MCGF 1 Soir", "fullname": "Master en Comptabilité et Gestion Financière - SOIR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1709, "classe": "MDBFA 1 Soir", "fullname": "Master en Droit, Banque, Finance, Assurance - SOIR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1710, "classe": "MGP 1 Soir", "fullname": "Master en Gestion des Projets - SOIR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    {"course_id": 1712, "classe": "MCCA 1 Soir", "fullname": "Master en Comptabilité, Contrôle et Audit - SOIR", "niveau": "Master", "subcat_id": 379, "total_feedbacks": 36},
    # MASTER 2 (380)
    {"course_id": 1692, "classe": "MCGF 2", "fullname": "Master en Comptabilité et Gestion Financière - M2", "niveau": "Master", "subcat_id": 380, "total_feedbacks": 36},
    {"course_id": 1693, "classe": "MCCA 2 Jour", "fullname": "Master en Comptabilité, Contrôle et Audit - M2 - JOUR", "niveau": "Master", "subcat_id": 380, "total_feedbacks": 36},
    {"course_id": 1694, "classe": "MDBFA 2", "fullname": "Master en Droit, Banque, Finance, Assurance - M2", "niveau": "Master", "subcat_id": 380, "total_feedbacks": 36},
    {"course_id": 1695, "classe": "MSMD 2", "fullname": "Master en Sciences du Management et de la Décision - M2", "niveau": "Master", "subcat_id": 380, "total_feedbacks": 36},
    {"course_id": 1696, "classe": "MBF", "fullname": "Master en Banque et Finance", "niveau": "Master", "subcat_id": 380, "total_feedbacks": 36},
    {"course_id": 1711, "classe": "MCCA 2 Soir", "fullname": "Master en Comptabilité, Contrôle et Audit - M2 - SOIR", "niveau": "Master", "subcat_id": 380, "total_feedbacks": 36},
    # MBA & DESCOGEF (375)
    {"course_id": 1697, "classe": "MBA AG", "fullname": "MBA en Administration et Gestion", "niveau": "MBA", "subcat_id": 375, "total_feedbacks": 36},
    {"course_id": 1698, "classe": "MBA ACG", "fullname": "MBA en Audit et Contrôle de Gestion", "niveau": "MBA", "subcat_id": 375, "total_feedbacks": 36},
    {"course_id": 1699, "classe": "MBA GP", "fullname": "MBA en Gestion des Projets", "niveau": "MBA", "subcat_id": 375, "total_feedbacks": 36},
    {"course_id": 1700, "classe": "MBA MSCH", "fullname": "MBA en Management Stratégique du Capital Humain", "niveau": "MBA", "subcat_id": 375, "total_feedbacks": 36},
    {"course_id": 1701, "classe": "MBA MPP", "fullname": "MBA en Management de la Performance Publique", "niveau": "MBA", "subcat_id": 375, "total_feedbacks": 36},
    {"course_id": 1702, "classe": "MBA MSS", "fullname": "MBA en Management des Services de Santé", "niveau": "MBA", "subcat_id": 375, "total_feedbacks": 36},
    {"course_id": 1703, "classe": "MBA ES", "fullname": "MBA en Économie de la Santé", "niveau": "MBA", "subcat_id": 375, "total_feedbacks": 36},
    {"course_id": 1704, "classe": "DESCOGEF 1", "fullname": "Diplôme d’Études Supérieures en Comptabilité et Gestion Financière - 1", "niveau": "Master", "subcat_id": 375, "total_feedbacks": 36},
    {"course_id": 1705, "classe": "DESCOGEF 2", "fullname": "Diplôme d’Études Supérieures en Comptabilité et Gestion Financière - 2", "niveau": "Master", "subcat_id": 375, "total_feedbacks": 36},
    {"course_id": 1706, "classe": "DESCOGEF 2 Spéciale", "fullname": "Diplôme d’Études Supérieures en Comptabilité et Gestion Financière - 2e année spéciale", "niveau": "Master", "subcat_id": 375, "total_feedbacks": 36},
]


def normalize_text(value: str) -> str:
    """Lowercase ASCII normalization for fuzzy matching."""
    text = unicodedata.normalize("NFKD", (value or "").strip().lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", " ", text).strip()
    return text


def slugify_id(niveau: str, sheet_name: str) -> str:
    """Stable program identifier."""
    base = normalize_text(f"{niveau} {sheet_name}").replace(" ", "-")
    return base


def clean_num(val: Any) -> int | float | None:
    if val is None or isinstance(val, bool):
        return None
    if isinstance(val, (int, float)):
        return int(val) if float(val).is_integer() else round(float(val), 2)
    text = str(val).strip().replace(",", ".")
    try:
        num = float(text)
        return int(num) if num.is_integer() else round(num, 2)
    except ValueError:
        return None


def is_banner_row(col0: str, col1: str) -> bool:
    """Detect semester or specialization banner rows without picking up footer notes."""
    if not col0 or col1:
        return False
    low = col0.lower()
    if any(
        low.startswith(prefix)
        for prefix in (
            "les crédits sont portés",
            "une valeur portée",
            "recomposition",
            "le second semestre",
            "le semestre 10",
            "total",
            "sous-total",
            "note",
        )
    ):
        return False
    return any(kw in low for kw in ("semestre", "spécialisation", "specialisation", "option"))


def derive_annee(niveau: str, ecue_code: str, semestre_banner: str) -> str:
    """Derive cohort year label (L1/L2/L3, M1/M2, MBA) from ECUE code or banner."""
    if niveau == "MBA":
        return "MBA"
    m = re.search(r"(\d+)\.\d+\.\d+", ecue_code)
    sem_num = int(m.group(1)) if m else None
    if sem_num is None:
        ms = re.search(r"semestre\s+(\d+)", semestre_banner, re.I)
        if ms:
            sem_num = int(ms.group(1))
        elif "premier semestre" in semestre_banner.lower():
            sem_num = 5
        elif "second semestre" in semestre_banner.lower() or "spécialisation" in semestre_banner.lower():
            sem_num = 6
    if niveau == "Licence":
        if sem_num in (1, 2):
            return "L1"
        if sem_num in (3, 4):
            return "L2"
        if sem_num in (5, 6):
            return "L3"
        return "L3"
    if niveau == "Master":
        if sem_num in (7, 8):
            return "M1"
        if sem_num in (9, 10):
            return "M2"
        return "Master"
    return niveau


def build_suggested_classes(
    niveau: str, sheet_name: str, annees: list[str], pilot_classes: list[str]
) -> list[str]:
    """Generate clean class suggestions aligned with Moodle Category 372 & pilot sheet."""
    suggestions: list[str] = []
    sheet_norm = normalize_text(sheet_name)

    # Match any pilot class belonging to this program
    for cls in pilot_classes:
        cls_norm = normalize_text(cls)
        if sheet_norm and (
            cls_norm.startswith(sheet_norm + " ")
            or cls_norm.startswith(sheet_norm.replace(" ", "") + "1")
            or cls_norm.startswith(sheet_norm.replace(" ", "") + "2")
            or cls_norm.startswith(sheet_norm + "-")
        ):
            if cls not in suggestions:
                suggestions.append(cls)

    # Match Moodle Category 372 courses
    for mc in MOODLE_COURSES_372:
        mc_norm = normalize_text(mc["classe"])
        if mc["niveau"] == niveau and (
            mc_norm == sheet_norm
            or mc_norm.startswith(sheet_norm + " ")
            or sheet_norm.startswith(mc_norm + " ")
        ):
            if mc["classe"] not in suggestions:
                suggestions.append(mc["classe"])

    # Standard CESAG cohort variations
    clean_code = sheet_name.split("·")[0].strip()
    if niveau == "Licence":
        base = clean_code
        if not any(s.startswith(base) for s in suggestions):
            suggestions.append(base)
        for variant in (f"{base} Jour A", f"{base} Jour B", f"{base} Soir"):
            if variant not in suggestions:
                suggestions.append(variant)
    elif niveau == "Master":
        base = clean_code
        if "M1" in annees and not re.search(r"\d$", base):
            for variant in (f"{base}1 Jour A", f"{base}1 Jour B", f"{base}1 Soir"):
                if variant not in suggestions:
                    suggestions.append(variant)
        if "M2" in annees and not re.search(r"\d$", base):
            for variant in (f"{base}2 Jour A", f"{base}2 Jour B", f"{base}2 Soir"):
                if variant not in suggestions:
                    suggestions.append(variant)
        if base not in suggestions:
            suggestions.append(base)
    elif niveau == "MBA":
        if "Online" in sheet_name:
            for variant in (f"{clean_code} Online", f"{clean_code} Online AUF"):
                if variant not in suggestions:
                    suggestions.append(variant)
        elif "Executive" in sheet_name:
            suggestions.append(f"{clean_code} Executive")
        else:
            for variant in (clean_code, f"{clean_code} Jour", f"{clean_code} Soir"):
                if variant not in suggestions:
                    suggestions.append(variant)

    return suggestions


def parse_plaquettes(pilot_classes: list[str]) -> dict[str, Any]:
    """Parse all 3 CESAG Excel workbooks into a unified structured catalog."""
    programs: list[dict[str, Any]] = []
    total_ecues = 0

    for niveau, filename in WORKBOOKS:
        filepath = PLAQUETTES_DIR / filename
        if not filepath.exists():
            raise FileNotFoundError(f"Plaquette workbook missing: {filepath}")

        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
        for sheet_name in wb.sheetnames:
            if sheet_name in SKIP_SHEETS:
                continue

            ws = wb[sheet_name]
            rows = list(ws.iter_rows(values_only=True))
            full_title = (
                str(rows[0][0]).strip()
                if rows and rows[0] and rows[0][0] is not None
                else sheet_name
            )

            current_semestre = "Tronc commun"
            current_ue_code = ""
            current_ue_titre = ""
            ecues: list[dict[str, Any]] = []

            for r_idx, row in enumerate(rows, 1):
                if r_idx <= 2 or not row:
                    continue
                col0 = str(row[0]).strip() if row[0] is not None else ""
                col1 = str(row[1]).strip() if len(row) > 1 and row[1] is not None else ""

                if not col0 and not col1:
                    continue
                low0 = col0.lower()
                if (
                    low0 == "code"
                    or low0.startswith("total")
                    or low0.startswith("sous-total")
                    or low0.startswith("parcours")
                    or low0.startswith("option ")
                ):
                    continue

                if is_banner_row(col0, col1):
                    current_semestre = re.sub(r"\s+", " ", col0).strip()
                    continue

                if not col1:
                    continue

                # ECUE row detection: X.Y.Z code format (never rely on empty credits!)
                if re.search(r"\d+\.\d+\.\d+", col0):
                    code_clean = re.sub(r"\s+", " ", col0).strip()
                    titre_clean = re.sub(r"\s+", " ", col1).strip()
                    annee = derive_annee(niveau, code_clean, current_semestre)
                    ecues.append(
                        {
                            "code": code_clean,
                            "titre": titre_clean,
                            "ue_code": current_ue_code,
                            "ue_titre": current_ue_titre,
                            "semestre": current_semestre,
                            "annee": annee,
                            "cm": clean_num(row[2] if len(row) > 2 else None),
                            "td_tp": clean_num(row[3] if len(row) > 3 else None),
                            "tpe": clean_num(row[4] if len(row) > 4 else None),
                            "total_h": clean_num(row[5] if len(row) > 5 else None),
                            "credits": clean_num(row[6] if len(row) > 6 else None),
                        }
                    )
                elif re.search(r"\d+\.\d+$", col0):
                    current_ue_code = re.sub(r"\s+", " ", col0).strip()
                    current_ue_titre = re.sub(r"\s+", " ", col1).strip()

            annees = []
            for e in ecues:
                if e["annee"] not in annees:
                    annees.append(e["annee"])

            semestres = []
            for e in ecues:
                if e["semestre"] not in semestres:
                    semestres.append(e["semestre"])

            classes_suggerees = build_suggested_classes(
                niveau, sheet_name, annees, pilot_classes
            )

            total_ecues += len(ecues)
            programs.append(
                {
                    "id": slugify_id(niveau, sheet_name),
                    "code": sheet_name,
                    "titre": full_title,
                    "niveau": niveau,
                    "annees": annees,
                    "semestres": semestres,
                    "classes_suggerees": classes_suggerees,
                    "ecue_count": len(ecues),
                    "ecues": ecues,
                }
            )

    return {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "moodle_base_url": "https://formations.cesagonline.com",
        "moodle_category_id": 372,
        "summary": {
            "total_programmes": len(programs),
            "total_ecues": total_ecues,
            "by_niveau": {
                niv: {
                    "programmes": sum(1 for p in programs if p["niveau"] == niv),
                    "ecues": sum(p["ecue_count"] for p in programs if p["niveau"] == niv),
                }
                for niv in ("Licence", "Master", "MBA")
            },
        },
        "moodle_courses": [
            {
                **c,
                "url": f"https://formations.cesagonline.com/course/view.php?id={c['course_id']}&section=1",
            }
            for c in MOODLE_COURSES_372
        ],
        "programs": programs,
    }


def guess_program_for_class(
    classe: str, module_title: str, programs: list[dict[str, Any]]
) -> tuple[str, str, str, str]:
    """Match a class and module title back to (niveau, programme, code_ecue, semestre)."""
    cls_norm = normalize_text(classe)
    mod_norm = normalize_text(module_title)

    # Order programs by longest normalized code first to avoid prefix collisions
    def match_score(prog: dict[str, Any]) -> int:
        pcode = normalize_text(prog["code"])
        if cls_norm == pcode:
            return 100 + len(pcode)
        if cls_norm.startswith(pcode + " ") or cls_norm.startswith(pcode + "-") or cls_norm.startswith(pcode.replace(" ", "") + "1") or cls_norm.startswith(pcode.replace(" ", "") + "2"):
            return 80 + len(pcode)
        # Handle MBF-TC-A -> MBF, MACG1 -> MACG, MDBFA1 -> MDBFA
        first_token = cls_norm.split(" ")[0]
        first_alpha = re.sub(r"\d+$", "", first_token)
        if first_alpha == pcode:
            return 70 + len(pcode)
        return 0

    candidates = sorted(
        [p for p in programs if match_score(p) > 0],
        key=match_score,
        reverse=True,
    )
    if not candidates:
        candidates = programs

    best_prog = candidates[0] if candidates else None
    matched_ecue = None

    # Search exact then fuzzy module title inside candidate programs
    for prog in candidates[:3]:
        for e in prog["ecues"]:
            e_norm = normalize_text(e["titre"])
            if e_norm == mod_norm:
                best_prog = prog
                matched_ecue = e
                break
        if matched_ecue:
            break

    if not matched_ecue:
        for prog in candidates[:3]:
            for e in prog["ecues"]:
                e_norm = normalize_text(e["titre"])
                if mod_norm and (mod_norm in e_norm or e_norm in mod_norm):
                    best_prog = prog
                    matched_ecue = e
                    break
            if matched_ecue:
                break

    if best_prog:
        return (
            best_prog["niveau"],
            best_prog["code"],
            matched_ecue["code"] if matched_ecue else "",
            matched_ecue["semestre"] if matched_ecue else "",
        )
    return ("Master", "", "", "")


def load_pilot_seed(programs: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str], list[dict[str, str]]]:
    """Load the 35 already-programmed evaluations from EVALUATIONS_PROGRAMMEES_AVEC_LIENS.xlsx."""
    if not PILOT_EXCEL.exists():
        return [], [], []

    wb = openpyxl.load_workbook(PILOT_EXCEL, read_only=True, data_only=True)
    ws = wb["Evaluations 26-27"]
    declarations: list[dict[str, Any]] = []
    pilot_classes: list[str] = []
    intervenants_map: dict[str, dict[str, str]] = {}

    now_iso = "2026-11-02T10:00:00Z"
    for idx, row in enumerate(ws.iter_rows(values_only=True)):
        if idx == 0 or not row or row[0] is None:
            continue
        num = row[0]
        classe = str(row[1] or "").strip()
        module = str(row[2] or "").strip()
        intervenant = str(row[3] or "").strip()
        email = str(row[4] or "").strip()
        cmid = str(row[5] or "").strip()
        lien = str(row[7] or "").strip()

        if classe and classe not in pilot_classes:
            pilot_classes.append(classe)

        if intervenant:
            key = normalize_text(intervenant)
            if key not in intervenants_map or (email and not intervenants_map[key]["email"]):
                intervenants_map[key] = {"nom": intervenant, "email": email}

        niveau, programme, code_ecue, semestre = guess_program_for_class(
            classe, module, programs
        )
        # Match Moodle course ID (space-insensitive match e.g. MACG1 -> MACG 1)
        moodle_course_id = None
        cls_compact = normalize_text(classe).replace(" ", "")
        for mc in sorted(MOODLE_COURSES_372, key=lambda x: len(x["classe"]), reverse=True):
            mc_compact = normalize_text(mc["classe"]).replace(" ", "")
            if cls_compact == mc_compact or cls_compact.startswith(mc_compact):
                moodle_course_id = mc["course_id"]
                break
        if moodle_course_id is None and programme:
            prog_compact = normalize_text(programme).replace(" ", "")
            for mc in MOODLE_COURSES_372:
                mc_compact = normalize_text(mc["classe"]).replace(" ", "")
                if mc_compact == prog_compact:
                    moodle_course_id = mc["course_id"]
                    break

        declarations.append(
            {
                "id": f"EVAL-2627-{int(num):04d}",
                "statut": "Programmee",
                "niveau": niveau,
                "programme": programme,
                "semestre": semestre,
                "classe": classe,
                "code_ecue": code_ecue,
                "module": module,
                "intervenant": intervenant,
                "email_intervenant": email,
                "date_fin_module": "",
                "declarant_nom": "Pilote Coordination 26-27",
                "declarant_email": "",
                "cmid": cmid,
                "moodle_course_id": moodle_course_id,
                "lien_moodle": lien or (f"https://formations.cesagonline.com/mod/feedback/view.php?id={cmid}" if cmid else ""),
                "date_ouverture": "2026-11-02",
                "date_cloture": "",
                "nb_repondants": None,
                "observations": "Import initial depuis les 35 évaluations ouvertes en catégorie 372",
                "source": "pilote_moodle_26_27",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        )

    intervenants = sorted(intervenants_map.values(), key=lambda x: x["nom"])
    return declarations, pilot_classes, intervenants


def main() -> None:
    parser = argparse.ArgumentParser(description="Build CESAG plaquettes catalog and pilot seed.")
    parser.add_argument(
        "--reset-seed",
        action="store_true",
        help="Overwrite data/declarations.json with the 35 pilot records.",
    )
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # First read pilot classes quickly to enrich suggested classes
    pilot_classes: list[str] = []
    if PILOT_EXCEL.exists():
        wb_p = openpyxl.load_workbook(PILOT_EXCEL, read_only=True, data_only=True)
        ws_p = wb_p["Evaluations 26-27"]
        for idx, r in enumerate(ws_p.iter_rows(values_only=True)):
            if idx > 0 and r and r[1]:
                cls = str(r[1]).strip()
                if cls not in pilot_classes:
                    pilot_classes.append(cls)

    catalog = parse_plaquettes(pilot_classes)
    declarations, _, _intervenants = load_pilot_seed(catalog["programs"])
    # Keep public catalog 100% free of personal names/emails (GitHub Pages safe);
    # lecturer autocomplete populates dynamically from private declarations at runtime.
    catalog["intervenants_connus"] = []
    catalog["classes_connues"] = sorted(
        list(
            {
                *pilot_classes,
                *(mc["classe"] for mc in MOODLE_COURSES_372),
            }
        )
    )

    catalog_json_path = PUBLIC_DATA_DIR / "catalog.json"
    catalog_js_path = PUBLIC_DATA_DIR / "catalog.js"
    with open(catalog_json_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    with open(catalog_js_path, "w", encoding="utf-8") as f:
        f.write("window.CESAG_CATALOG = ")
        json.dump(catalog, f, ensure_ascii=False)
        f.write(";\n")

    decl_path = DATA_DIR / "declarations.json"
    if args.reset_seed or not decl_path.exists():
        with open(decl_path, "w", encoding="utf-8") as f:
            json.dump(declarations, f, ensure_ascii=False, indent=2)
        seed_msg = f"Seeded {len(declarations)} pilot records into {decl_path}"
    else:
        seed_msg = f"Preserved existing {decl_path}"

    print(
        f"Catalog built: {catalog['summary']['total_programmes']} programmes, "
        f"{catalog['summary']['total_ecues']} ECUEs -> {catalog['summary']['by_niveau']}"
    )
    print(seed_msg)


if __name__ == "__main__":
    main()
