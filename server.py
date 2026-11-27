#!/usr/bin/env python3
"""Local HTTP server & REST API for CESAG Course Evaluations 2026-2027."""

from __future__ import annotations

import datetime
import html
import io
import json
import mimetypes
import os
import re
import threading
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill

ROOT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT_DIR / "public"
DATA_DIR = ROOT_DIR / "data"
DECLARATIONS_PATH = DATA_DIR / "declarations.json"
CATALOG_PATH = PUBLIC_DIR / "data" / "catalog.json"

DATA_LOCK = threading.Lock()
MOODLE_BASE_URL = "https://formations.cesagonline.com"
MOODLE_CATEGORY_ID = 372

ALLOWED_STATUTS = {"A_programmer", "Programmee", "Realisee", "Annulee"}
EDITABLE_FIELDS = {
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
}


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", (value or "").strip().lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def load_catalog() -> dict[str, Any]:
    if not CATALOG_PATH.exists():
        return {"programs": [], "moodle_courses": [], "intervenants_connus": []}
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_declarations() -> list[dict[str, Any]]:
    with DATA_LOCK:
        if not DECLARATIONS_PATH.exists():
            return []
        with open(DECLARATIONS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)


def save_declarations(items: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp_path = DECLARATIONS_PATH.with_suffix(".json.tmp")
    with DATA_LOCK:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, DECLARATIONS_PATH)


def next_declaration_id(existing: list[dict[str, Any]]) -> str:
    max_num = 0
    for item in existing:
        m = re.search(r"EVAL-2627-(\d+)", str(item.get("id", "")))
        if m:
            max_num = max(max_num, int(m.group(1)))
    return f"EVAL-2627-{max_num + 1:04d}"


def build_carton_vert_html(module: str, intervenant: str, classe: str = "") -> str:
    """Exact CESAG official HTML card injected in Moodle Feedback description."""
    mod_esc = html.escape(module.strip())
    int_esc = html.escape(intervenant.strip())
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:0 auto;'
        'background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;'
        'box-shadow:0 4px 14px rgba(0,0,0,0.06);">'
        '<div style="background:#0B4D2E;padding:20px 24px;color:#ffffff;">'
        '<div style="font-size:21px;font-weight:700;line-height:1.3;">Évaluation de l’enseignement</div>'
        '<div style="margin-top:5px;font-size:13px;color:#DDE9E2;">'
        "Votre retour contribue à l’amélioration continue de la qualité académique"
        "</div></div>"
        '<div style="padding:24px;color:#1F2937;font-size:15px;line-height:1.65;">'
        '<p style="margin:0 0 14px 0;">Chers étudiants,</p>'
        '<p style="margin:0 0 16px 0;">'
        "Nous vous invitons à bien vouloir procéder à l’évaluation du module : "
        f"<strong>{mod_esc}</strong> (Enseignant : <strong>{int_esc}</strong>). "
        "Votre appréciation nous permet de mieux comprendre votre expérience et d’identifier les axes d’amélioration."
        "</p>"
        '<div style="background:#F7F8FA;border-left:4px solid #C9962A;padding:14px 16px;'
        'margin:18px 0;border-radius:6px;">'
        '<strong style="color:#0B4D2E;">Confidentialité des réponses</strong><br>'
        "Cette évaluation n’est pas anonyme afin de nous permettre de nous assurer de la participation de tous. "
        "Les réponses sont toutefois traitées de manière confidentielle."
        "</div>"
        '<p style="margin:0;">Nous vous remercions de répondre avec sincérité, objectivité et responsabilité.</p>'
        "</div>"
        '<div style="background:#F7F8FA;padding:13px 24px;border-top:1px solid #E5E7EB;'
        'color:#59636E;font-size:12px;">'
        "CESAG – Amélioration continue de la qualité des enseignements"
        "</div></div>"
    )


def match_catalog_entry(
    classe: str, module_title: str, catalog: dict[str, Any]
) -> dict[str, Any]:
    """Match class and module title against official plaquettes + Moodle courses."""
    programs = catalog.get("programs", [])
    moodle_courses = catalog.get("moodle_courses", [])
    cls_norm = normalize_text(classe)
    cls_compact = cls_norm.replace(" ", "")
    mod_norm = normalize_text(module_title)

    def prog_score(prog: dict[str, Any]) -> int:
        pcode = normalize_text(prog.get("code", ""))
        if not pcode:
            return 0
        p_compact = pcode.replace(" ", "")
        if cls_norm == pcode or cls_compact == p_compact:
            return 100 + len(pcode)
        if (
            cls_norm.startswith(pcode + " ")
            or cls_norm.startswith(pcode + "-")
            or cls_compact.startswith(p_compact + "1")
            or cls_compact.startswith(p_compact + "2")
        ):
            return 80 + len(pcode)
        first_alpha = re.sub(r"\d+$", "", cls_norm.split(" ")[0])
        if first_alpha == pcode:
            return 70 + len(pcode)
        return 0

    candidates = sorted(
        [p for p in programs if prog_score(p) > 0],
        key=prog_score,
        reverse=True,
    )
    best_prog = candidates[0] if candidates else None
    matched_ecue = None

    search_pool = candidates[:3] if candidates else programs
    for prog in search_pool:
        for e in prog.get("ecues", []):
            if normalize_text(e.get("titre", "")) == mod_norm:
                best_prog = prog
                matched_ecue = e
                break
        if matched_ecue:
            break

    if not matched_ecue and mod_norm:
        for prog in search_pool:
            for e in prog.get("ecues", []):
                en = normalize_text(e.get("titre", ""))
                if mod_norm in en or en in mod_norm:
                    best_prog = prog
                    matched_ecue = e
                    break
            if matched_ecue:
                break

    moodle_course_id = None
    for mc in sorted(moodle_courses, key=lambda x: len(x.get("classe", "")), reverse=True):
        mc_compact = normalize_text(mc.get("classe", "")).replace(" ", "")
        if mc_compact and (cls_compact == mc_compact or cls_compact.startswith(mc_compact)):
            moodle_course_id = mc.get("course_id")
            break
    if moodle_course_id is None and best_prog:
        prog_compact = normalize_text(best_prog.get("code", "")).replace(" ", "")
        for mc in moodle_courses:
            if normalize_text(mc.get("classe", "")).replace(" ", "") == prog_compact:
                moodle_course_id = mc.get("course_id")
                break

    return {
        "niveau": best_prog.get("niveau", "") if best_prog else "",
        "programme": best_prog.get("code", "") if best_prog else "",
        "code_ecue": matched_ecue.get("code", "") if matched_ecue else "",
        "semestre": matched_ecue.get("semestre", "") if matched_ecue else "",
        "moodle_course_id": moodle_course_id,
    }


def compute_stats(items: list[dict[str, Any]]) -> dict[str, Any]:
    active = [x for x in items if x.get("statut") != "Annulee"]
    a_prog = sum(1 for x in items if x.get("statut") == "A_programmer")
    prog = sum(1 for x in items if x.get("statut") == "Programmee")
    real = sum(1 for x in items if x.get("statut") == "Realisee")
    annul = sum(1 for x in items if x.get("statut") == "Annulee")
    total_active = len(active)
    programmee_ou_plus = prog + real
    taux_prog = round((programmee_ou_plus / total_active) * 100, 1) if total_active else 0.0
    taux_real = round((real / total_active) * 100, 1) if total_active else 0.0
    total_repondants = sum(
        int(x["nb_repondants"])
        for x in items
        if isinstance(x.get("nb_repondants"), (int, float))
    )

    par_niveau = {}
    for niv in ("Licence", "Master", "MBA"):
        sub = [x for x in items if x.get("niveau") == niv]
        par_niveau[niv] = {
            "total": len(sub),
            "a_programmer": sum(1 for x in sub if x.get("statut") == "A_programmer"),
            "programmee": sum(1 for x in sub if x.get("statut") == "Programmee"),
            "realisee": sum(1 for x in sub if x.get("statut") == "Realisee"),
        }

    return {
        "total": len(items),
        "total_actives": total_active,
        "a_programmer": a_prog,
        "programmee": prog,
        "realisee": real,
        "annulee": annul,
        "programmee_ou_plus": programmee_ou_plus,
        "taux_programmation": taux_prog,
        "taux_realisation": taux_real,
        "total_repondants": total_repondants,
        "par_niveau": par_niveau,
    }


def build_excel_bytes(items: list[dict[str, Any]]) -> bytes:
    """Create styled CESAG Excel workbook with Evaluations 26-27 + Synthese KPI."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Evaluations 26-27"

    headers = [
        "ID",
        "Statut",
        "Niveau",
        "Programme",
        "Semestre",
        "Classe",
        "Code ECUE",
        "Module",
        "Intervenant",
        "Email Intervenant",
        "Date Fin Module",
        "Déclarant",
        "CMID",
        "Lien Direct Moodle",
        "Date Ouverture",
        "Date Clôture",
        "Nb Répondants",
        "Observations",
    ]

    header_fill = PatternFill(start_color="0B4D2E", end_color="0B4D2E", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=11)
    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 26

    statut_labels = {
        "A_programmer": "À programmer",
        "Programmee": "Programmée / Ouverte",
        "Realisee": "Réalisée / Clôturée",
        "Annulee": "Annulée",
    }

    for row_idx, item in enumerate(items, start=2):
        lien = item.get("lien_moodle") or ""
        row_vals = [
            item.get("id", ""),
            statut_labels.get(item.get("statut", ""), item.get("statut", "")),
            item.get("niveau", ""),
            item.get("programme", ""),
            item.get("semestre", ""),
            item.get("classe", ""),
            item.get("code_ecue", ""),
            item.get("module", ""),
            item.get("intervenant", ""),
            item.get("email_intervenant", ""),
            item.get("date_fin_module", ""),
            item.get("declarant_nom", ""),
            item.get("cmid", ""),
            lien,
            item.get("date_ouverture", ""),
            item.get("date_cloture", ""),
            item.get("nb_repondants") if item.get("nb_repondants") is not None else "",
            item.get("observations", ""),
        ]
        ws.append(row_vals)
        if lien.startswith("http"):
            link_cell = ws.cell(row=row_idx, column=14)
            link_cell.hyperlink = lien
            link_cell.font = Font(color="0B4D2E", underline="single")

    widths = [16, 22, 11, 16, 18, 18, 14, 42, 28, 30, 15, 22, 10, 48, 15, 15, 14, 34]
    for idx, w in enumerate(widths, start=1):
        col_letter = openpyxl.utils.get_column_letter(idx)
        ws.column_dimensions[col_letter].width = w
    ws.freeze_panes = "A2"

    # Sheet 2: Synthese KPI
    ws_kpi = wb.create_sheet("Synthese KPI")
    stats = compute_stats(items)
    ws_kpi.append(["SYNTHÈSE SUIVI-ÉVALUATION CESAG 2026-2027", ""])
    ws_kpi["A1"].font = Font(bold=True, size=13, color="0B4D2E")
    ws_kpi.append(["Généré le", now_iso()])
    ws_kpi.append([])
    ws_kpi.append(["Indicateur Global", "Valeur"])
    for cell in (ws_kpi["A4"], ws_kpi["B4"]):
        cell.fill = header_fill
        cell.font = header_font
    kpi_rows = [
        ("Total déclarations", stats["total"]),
        ("Déclarations actives", stats["total_actives"]),
        ("À programmer sur Moodle", stats["a_programmer"]),
        ("Programmées / Ouvertes", stats["programmee"]),
        ("Réalisées / Clôturées", stats["realisee"]),
        ("Annulées", stats["annulee"]),
        ("Taux de programmation (%)", stats["taux_programmation"]),
        ("Taux de réalisation (%)", stats["taux_realisation"]),
        ("Total répondants enregistrés", stats["total_repondants"]),
    ]
    for k, v in kpi_rows:
        ws_kpi.append([k, v])

    ws_kpi.append([])
    ws_kpi.append(["Niveau", "Total", "À programmer", "Programmées", "Réalisées"])
    r_hdr = ws_kpi.max_row
    for col_idx in range(1, 6):
        c = ws_kpi.cell(row=r_hdr, column=col_idx)
        c.fill = header_fill
        c.font = header_font
    for niv, data in stats["par_niveau"].items():
        ws_kpi.append([niv, data["total"], data["a_programmer"], data["programmee"], data["realisee"]])

    ws_kpi.column_dimensions["A"].width = 34
    ws_kpi.column_dimensions["B"].width = 22
    ws_kpi.column_dimensions["C"].width = 16
    ws_kpi.column_dimensions["D"].width = 16
    ws_kpi.column_dimensions["E"].width = 16

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class CesagEvalHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        # Keep console logs concise
        pass

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, status: int, content_type: str, data: bytes, filename: str | None = None) -> None:
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", content_type)
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json_body(self) -> Any:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path == "/api/health":
            items = load_declarations()
            self._send_json(
                200,
                {
                    "status": "ok",
                    "mode": "local",
                    "count": len(items),
                    "timestamp": now_iso(),
                },
            )
            return

        if path == "/api/catalog":
            self._send_json(200, load_catalog())
            return

        if path == "/api/declarations":
            items = load_declarations()
            self._send_json(
                200,
                {
                    "declarations": items,
                    "stats": compute_stats(items),
                },
            )
            return

        if path == "/api/export/excel":
            items = load_declarations()
            xlsx = build_excel_bytes(items)
            fname = f"CESAG_Evaluations_26_27_{datetime.date.today().isoformat()}.xlsx"
            self._send_bytes(
                200,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                xlsx,
                filename=fname,
            )
            return

        if path == "/api/export/pending":
            items = load_declarations()
            catalog = load_catalog()
            pending = []
            for item in items:
                if item.get("statut") != "A_programmer":
                    continue
                enriched = dict(item)
                if not enriched.get("moodle_course_id"):
                    matched = match_catalog_entry(
                        enriched.get("classe", ""), enriched.get("module", ""), catalog
                    )
                    if matched["moodle_course_id"]:
                        enriched["moodle_course_id"] = matched["moodle_course_id"]
                enriched["moodle_category_id"] = MOODLE_CATEGORY_ID
                enriched["carton_vert_html"] = build_carton_vert_html(
                    enriched.get("module", ""),
                    enriched.get("intervenant", ""),
                    enriched.get("classe", ""),
                )
                pending.append(enriched)

            self._send_json(
                200,
                {
                    "generated_at": now_iso(),
                    "moodle_base_url": MOODLE_BASE_URL,
                    "moodle_category_id": MOODLE_CATEGORY_ID,
                    "count": len(pending),
                    "items": pending,
                },
            )
            return

        # Serve static files from public/
        rel_path = path.lstrip("/") or "index.html"
        target = (PUBLIC_DIR / rel_path).resolve()
        if not str(target).startswith(str(PUBLIC_DIR.resolve())) or not target.is_file():
            self._send_json(404, {"error": "Not found"})
            return

        mime, _ = mimetypes.guess_type(str(target))
        if target.suffix == ".js":
            mime = "application/javascript; charset=utf-8"
        elif target.suffix == ".css":
            mime = "text/css; charset=utf-8"
        elif target.suffix == ".html":
            mime = "text/html; charset=utf-8"
        elif target.suffix == ".json":
            mime = "application/json; charset=utf-8"
        with open(target, "rb") as f:
            data = f.read()
        self._send_bytes(200, mime or "application/octet-stream", data)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        try:
            body = self._read_json_body()
        except Exception as exc:
            self._send_json(400, {"error": f"JSON invalide: {exc}"})
            return

        if path == "/api/declarations":
            raw_items = body.get("items") if isinstance(body, dict) and "items" in body else [body]
            if not isinstance(raw_items, list) or not raw_items:
                self._send_json(400, {"error": "Aucun module fourni dans la requête."})
                return

            force = bool(body.get("force", False)) if isinstance(body, dict) else False
            catalog = load_catalog()
            existing = load_declarations()
            active_keys = {
                (normalize_text(x.get("classe", "")), normalize_text(x.get("module", ""))): x
                for x in existing
                if x.get("statut") != "Annulee"
            }

            duplicates = []
            prepared = []
            ts = now_iso()

            for entry in raw_items:
                classe = str(entry.get("classe", "")).strip()
                module = str(entry.get("module", "")).strip()
                intervenant = str(entry.get("intervenant", "")).strip()
                if not classe or not module or not intervenant:
                    self._send_json(
                        400,
                        {"error": "Champs obligatoires manquants (classe, module, intervenant)."},
                    )
                    return

                key = (normalize_text(classe), normalize_text(module))
                if key in active_keys and not force:
                    duplicates.append(
                        {
                            "classe": classe,
                            "module": module,
                            "existing_id": active_keys[key].get("id"),
                            "existing_statut": active_keys[key].get("statut"),
                        }
                    )
                    continue

                matched = match_catalog_entry(classe, module, catalog)
                new_id = next_declaration_id(existing + prepared)
                cmid = str(entry.get("cmid", "")).strip()
                lien = str(entry.get("lien_moodle", "")).strip()
                if cmid and not lien:
                    lien = f"{MOODLE_BASE_URL}/mod/feedback/view.php?id={cmid}"

                statut = str(entry.get("statut", "A_programmer")).strip()
                if statut not in ALLOWED_STATUTS:
                    statut = "A_programmer"

                prepared.append(
                    {
                        "id": new_id,
                        "statut": statut,
                        "niveau": str(entry.get("niveau", "")).strip() or matched["niveau"],
                        "programme": str(entry.get("programme", "")).strip() or matched["programme"],
                        "semestre": str(entry.get("semestre", "")).strip() or matched["semestre"],
                        "classe": classe,
                        "code_ecue": str(entry.get("code_ecue", "")).strip() or matched["code_ecue"],
                        "module": module,
                        "intervenant": intervenant,
                        "email_intervenant": str(entry.get("email_intervenant", "")).strip(),
                        "date_fin_module": str(entry.get("date_fin_module", "")).strip(),
                        "declarant_nom": str(entry.get("declarant_nom", "")).strip(),
                        "declarant_email": str(entry.get("declarant_email", "")).strip(),
                        "cmid": cmid,
                        "moodle_course_id": entry.get("moodle_course_id") or matched["moodle_course_id"],
                        "lien_moodle": lien,
                        "date_ouverture": str(entry.get("date_ouverture", "")).strip(),
                        "date_cloture": str(entry.get("date_cloture", "")).strip(),
                        "nb_repondants": entry.get("nb_repondants"),
                        "observations": str(entry.get("observations", "")).strip(),
                        "source": str(entry.get("source", "mini_plateforme")).strip(),
                        "created_at": ts,
                        "updated_at": ts,
                    }
                )

            if duplicates and not force:
                self._send_json(
                    409,
                    {
                        "error": "duplicate",
                        "message": f"{len(duplicates)} module(s) déjà présent(s) pour cette classe.",
                        "duplicates": duplicates,
                    },
                )
                return

            existing.extend(prepared)
            save_declarations(existing)
            self._send_json(
                201,
                {
                    "added": len(prepared),
                    "items": prepared,
                    "stats": compute_stats(existing),
                },
            )
            return

        if path == "/api/import-rows":
            rows = body.get("rows") if isinstance(body, dict) else body
            if not isinstance(rows, list):
                self._send_json(400, {"error": "Format attendu: {rows: [...]}"})
                return

            declarant_nom = str(body.get("declarant_nom", "Import Fichier Collègue")).strip() if isinstance(body, dict) else "Import Fichier Collègue"
            declarant_email = str(body.get("declarant_email", "")).strip() if isinstance(body, dict) else ""
            force = bool(body.get("force", False)) if isinstance(body, dict) else False

            catalog = load_catalog()
            existing = load_declarations()
            active_keys = {
                (normalize_text(x.get("classe", "")), normalize_text(x.get("module", "")))
                for x in existing
                if x.get("statut") != "Annulee"
            }

            added_items = []
            skipped_duplicates = []
            invalid = []
            ts = now_iso()

            for idx, r in enumerate(rows, 1):
                if not isinstance(r, dict):
                    continue
                module = str(r.get("Modules") or r.get("Module") or r.get("module") or "").strip()
                intervenant = str(r.get("Intervenants") or r.get("Intervenant") or r.get("intervenant") or "").strip()
                classe = str(r.get("Classe") or r.get("classe") or "").strip()
                email = str(r.get("Adresse email") or r.get("Email") or r.get("email_intervenant") or "").strip()
                date_fin = str(r.get("Date de fin") or r.get("date_fin_module") or "").strip()

                if not classe or not module or not intervenant:
                    invalid.append({"ligne": idx, "classe": classe, "module": module, "intervenant": intervenant})
                    continue

                key = (normalize_text(classe), normalize_text(module))
                if key in active_keys and not force:
                    skipped_duplicates.append({"ligne": idx, "classe": classe, "module": module})
                    continue

                active_keys.add(key)
                matched = match_catalog_entry(classe, module, catalog)
                new_id = next_declaration_id(existing + added_items)

                added_items.append(
                    {
                        "id": new_id,
                        "statut": "A_programmer",
                        "niveau": matched["niveau"],
                        "programme": matched["programme"],
                        "semestre": matched["semestre"],
                        "classe": classe,
                        "code_ecue": matched["code_ecue"],
                        "module": module,
                        "intervenant": intervenant,
                        "email_intervenant": email,
                        "date_fin_module": date_fin,
                        "declarant_nom": declarant_nom,
                        "declarant_email": declarant_email,
                        "cmid": "",
                        "moodle_course_id": matched["moodle_course_id"],
                        "lien_moodle": "",
                        "date_ouverture": "",
                        "date_cloture": "",
                        "nb_repondants": None,
                        "observations": "Import depuis tableau collègue",
                        "source": "import_collegue",
                        "created_at": ts,
                        "updated_at": ts,
                    }
                )

            existing.extend(added_items)
            save_declarations(existing)
            self._send_json(
                200,
                {
                    "added": len(added_items),
                    "skipped_duplicates": len(skipped_duplicates),
                    "invalid": len(invalid),
                    "duplicates_detail": skipped_duplicates,
                    "items": added_items,
                    "stats": compute_stats(existing),
                },
            )
            return

        if path == "/api/import-moodle-results":
            results = body.get("results") if isinstance(body, dict) and "results" in body else body
            if not isinstance(results, list):
                self._send_json(400, {"error": "Liste de résultats Moodle attendue."})
                return

            existing = load_declarations()
            by_id = {x["id"]: x for x in existing}
            updated = 0
            ts = now_iso()

            for res in results:
                if not isinstance(res, dict):
                    continue
                rec_id = str(res.get("id", "")).strip()
                target = by_id.get(rec_id)
                if not target:
                    # Fallback match by (classe, module)
                    key = (
                        normalize_text(str(res.get("classe", ""))),
                        normalize_text(str(res.get("module", ""))),
                    )
                    for item in existing:
                        if (
                            normalize_text(item.get("classe", "")),
                            normalize_text(item.get("module", "")),
                        ) == key:
                            target = item
                            break
                if not target:
                    continue

                for field in ("cmid", "lien_moodle", "statut", "date_ouverture", "date_cloture", "nb_repondants", "moodle_course_id", "observations"):
                    if field in res and res[field] is not None and res[field] != "":
                        target[field] = res[field]
                if target.get("cmid") and not target.get("lien_moodle"):
                    target["lien_moodle"] = f"{MOODLE_BASE_URL}/mod/feedback/view.php?id={target['cmid']}"
                if res.get("statut") is None and target.get("cmid"):
                    target["statut"] = "Programmee"
                target["updated_at"] = ts
                updated += 1

            save_declarations(existing)
            self._send_json(
                200,
                {
                    "updated": updated,
                    "stats": compute_stats(existing),
                },
            )
            return

        self._send_json(404, {"error": "Endpoint POST inconnu"})

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if not path.startswith("/api/declarations/"):
            self._send_json(404, {"error": "Endpoint PATCH inconnu"})
            return

        rec_id = path[len("/api/declarations/") :].strip("/")
        try:
            body = self._read_json_body()
        except Exception as exc:
            self._send_json(400, {"error": f"JSON invalide: {exc}"})
            return

        existing = load_declarations()
        target = next((x for x in existing if x.get("id") == rec_id), None)
        if not target:
            self._send_json(404, {"error": f"Déclaration {rec_id} introuvable"})
            return

        for key, val in body.items():
            if key not in EDITABLE_FIELDS:
                continue
            if key == "statut" and val not in ALLOWED_STATUTS:
                self._send_json(400, {"error": f"Statut invalide: {val}"})
                return
            if key == "nb_repondants":
                if val in ("", None):
                    target[key] = None
                else:
                    try:
                        target[key] = int(val)
                    except (TypeError, ValueError):
                        self._send_json(400, {"error": "nb_repondants doit être un entier"})
                        return
            else:
                target[key] = val.strip() if isinstance(val, str) else val

        if target.get("cmid") and not target.get("lien_moodle"):
            target["lien_moodle"] = f"{MOODLE_BASE_URL}/mod/feedback/view.php?id={target['cmid']}"
        target["updated_at"] = now_iso()
        save_declarations(existing)
        self._send_json(200, {"item": target, "stats": compute_stats(existing)})

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if not path.startswith("/api/declarations/"):
            self._send_json(404, {"error": "Endpoint DELETE inconnu"})
            return

        rec_id = path[len("/api/declarations/") :].strip("/")
        existing = load_declarations()
        new_items = [x for x in existing if x.get("id") != rec_id]
        if len(new_items) == len(existing):
            self._send_json(404, {"error": f"Déclaration {rec_id} introuvable"})
            return

        save_declarations(new_items)
        self._send_json(200, {"deleted": rec_id, "stats": compute_stats(new_items)})


def run_server() -> None:
    port = int(os.environ.get("PORT", "8765"))
    host = os.environ.get("HOST", "127.0.0.1")
    server = ThreadingHTTPServer((host, port), CesagEvalHandler)
    print(f"CESAG Mini-Plateforme running on http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
