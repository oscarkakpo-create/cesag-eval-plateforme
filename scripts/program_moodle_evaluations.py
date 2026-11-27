#!/usr/bin/env python3
"""Prepare and execute Moodle Category 372 evaluation scheduling from pending declarations.

By default runs in --dry-run mode (read-only simulation).
When called with --execute --session <storage_state.json>, uses Playwright with the
exact official CESAG card template (CARD_TEMPLATE) and modedit.php workflow used
on the 35 realized evaluations.
"""

from __future__ import annotations

import argparse
import asyncio
import datetime
import html
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DECLARATIONS = ROOT_DIR / "data" / "declarations.json"
DEFAULT_CATALOG = ROOT_DIR / "public" / "data" / "catalog.json"
MOODLE_BASE_URL = "https://formations.cesagonline.com"
MOODLE_CATEGORY_ID = 372
# Durée par défaut d'un feedback quand aucune date de clôture n'est demandée.
# Passé cette date, l'évaluation s'affiche « Clôturé » sur la plateforme.
DUREE_FEEDBACK_JOURS = 14


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", (value or "").strip().lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def build_carton_vert_html(module: str, intervenant: str, _classe: str = "") -> str:
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


def load_pending_items(input_path: Path) -> list[dict[str, Any]]:
    if not input_path.exists():
        raise FileNotFoundError(f"Fichier introuvable : {input_path}")
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data.get("items", []) if isinstance(data, dict) else data
    return [x for x in items if x.get("statut") == "A_programmer"]


def resolve_course_id(item: dict[str, Any], catalog: dict[str, Any]) -> int | None:
    if item.get("moodle_course_id"):
        return int(item["moodle_course_id"])
    cls_compact = normalize_text(item.get("classe", "")).replace(" ", "")
    for mc in sorted(
        catalog.get("moodle_courses", []),
        key=lambda x: len(x.get("classe", "")),
        reverse=True,
    ):
        mc_compact = normalize_text(mc.get("classe", "")).replace(" ", "")
        if mc_compact and (cls_compact == mc_compact or cls_compact.startswith(mc_compact)):
            return int(mc["course_id"])
    return None


async def execute_playwright(
    planned: list[dict[str, Any]], session_file: Path, output_path: Path, sync_local: bool
) -> None:
    from playwright.async_api import async_playwright

    results: list[dict[str, Any]] = []
    today = datetime.date.today().isoformat()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(storage_state=str(session_file))
        page = await ctx.new_page()

        # Group by course_id to inspect activities once per course
        course_cache: dict[int, list[dict[str, Any]]] = {}
        used_cmids: set[str] = set()

        for item in planned:
            cid = item["moodle_course_id"]
            if not cid:
                print(f"[SKIP] {item['id']} ({item['classe']}): course_id Moodle non résolu")
                continue

            if cid not in course_cache:
                await page.goto(
                    f"{MOODLE_BASE_URL}/course/view.php?id={cid}&section=1",
                    wait_until="networkidle",
                )
                if "login/index.php" in page.url:
                    await browser.close()
                    raise RuntimeError("Session Moodle expirée : veuillez vous reconnecter.")

                course_cache[cid] = await page.evaluate(
                    """() => Array.from(document.querySelectorAll('.activity')).map(a => {
                        const link = a.querySelector('a[href*="/mod/feedback/"]');
                        if (!link) return null;
                        const cmid = a.getAttribute('data-id') || (a.id.startsWith('module-') ? a.id.replace('module-', '') : '');
                        const nameEl = a.querySelector('.instancename, .activityname');
                        const name = nameEl ? nameEl.innerText.split('\\n')[0].trim() : link.innerText.trim();
                        const hidden = a.classList.contains('dimmed') || a.innerText.includes('Caché pour les étudiants');
                        return { cmid: String(cmid), name, hidden };
                    }).filter(Boolean)"""
                )

            activities = course_cache[cid]
            mod_norm = normalize_text(item["module"])

            # 1. Exact/fuzzy match on renamed Feedback activity
            match = next(
                (a for a in activities if a["cmid"] not in used_cmids and normalize_text(a["name"]) == mod_norm),
                None,
            ) or next(
                (a for a in activities if a["cmid"] not in used_cmids and mod_norm and mod_norm in normalize_text(a["name"])),
                None,
            )

            # 2. Fallback: first available hidden placeholder "MODULE <N>" (lowest N first)
            if not match:
                placeholders = [
                    a
                    for a in activities
                    if a["cmid"] not in used_cmids
                    and a["hidden"]
                    and re.match(r"^MODULE\s+(\d+)$", a["name"].strip(), re.I)
                ]
                placeholders.sort(
                    key=lambda a: int(re.match(r"^MODULE\s+(\d+)$", a["name"].strip(), re.I).group(1))
                )
                if placeholders:
                    match = placeholders[0]

            if not match:
                print(f"[NOT_FOUND] {item['id']}: aucun Feedback ou slot MODULE disponible dans cours {cid}")
                continue

            cmid = match["cmid"]
            used_cmids.add(cmid)

            modedit_url = f"{MOODLE_BASE_URL}/course/modedit.php?update={cmid}&return=0"
            await page.goto(modedit_url, wait_until="networkidle")
            if "login/index.php" in page.url:
                await browser.close()
                raise RuntimeError("Session Moodle expirée pendant l'édition.")

            await page.evaluate(
                """({ moduleName, introHtml }) => {
                    const nameField = document.querySelector('#id_name');
                    if (nameField) nameField.value = moduleName;
                    const introEditable = document.querySelector('#id_introeditoreditable');
                    if (introEditable) introEditable.innerHTML = introHtml;
                    const introTextarea = document.querySelector('#id_intro');
                    if (introTextarea) introTextarea.value = introHtml;
                    const vis = document.querySelector('#id_visible');
                    if (vis) vis.value = '1';
                }""",
                {"moduleName": item["module"], "introHtml": item["carton_vert_html"]},
            )
            await page.click("#id_submitbutton2")
            await page.wait_for_load_state("networkidle")

            result = {
                "id": item["id"],
                "classe": item["classe"],
                "module": item["module"],
                "cmid": cmid,
                "moodle_course_id": cid,
                "lien_moodle": f"{MOODLE_BASE_URL}/mod/feedback/view.php?id={cmid}",
                "statut": "Programmee",
                "date_ouverture": today,
                "date_cloture": (str(item.get("date_cloture") or "")[:10]
                                 or (datetime.date.today() + datetime.timedelta(days=DUREE_FEEDBACK_JOURS)).isoformat()),
                "observations": f"Configuré & rendu visible sur Moodle ({item['intervenant']})",
            }
            results.append(result)
            print(f"[OK] {item['id']} | {item['classe']} | CMID {cmid} -> '{item['module']}' ({item['intervenant']})")

        await browser.close()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Résultats enregistrés dans {output_path} ({len(results)} entrée(s)).")

    if sync_local and results and DEFAULT_DECLARATIONS.exists():
        with open(DEFAULT_DECLARATIONS, "r", encoding="utf-8") as f:
            decls = json.load(f)
        by_id = {r["id"]: r for r in results}
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        for d in decls:
            if d.get("id") in by_id:
                r = by_id[d["id"]]
                d["cmid"] = r["cmid"]
                d["moodle_course_id"] = r["moodle_course_id"]
                d["lien_moodle"] = r["lien_moodle"]
                d["statut"] = "Programmee"
                d["date_ouverture"] = r["date_ouverture"]
                d["date_cloture"] = r["date_cloture"]
                d["observations"] = r["observations"]
                d["updated_at"] = now_str
        with open(DEFAULT_DECLARATIONS, "w", encoding="utf-8") as f:
            json.dump(decls, f, ensure_ascii=False, indent=2)
        print(f"Base locale {DEFAULT_DECLARATIONS} synchronisée ({len(results)} mise(s) à jour).")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Automatisation Moodle CESAG Catégorie 372 (Dry-run par défaut)."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_DECLARATIONS,
        help="Chemin vers lot_a_programmer.json ou data/declarations.json",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mode simulation sans modification sur Moodle (actif par défaut sans --execute).",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Exécuter réellement la configuration et le passage à Visible sur Moodle via Playwright.",
    )
    parser.add_argument(
        "--session",
        type=Path,
        help="Fichier JSON Playwright storage_state de session Moodle.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT_DIR / "data" / "resultats_moodle.json",
        help="Fichier de sortie JSON réimportable dans la mini-plateforme.",
    )
    parser.add_argument(
        "--sync-local",
        action="store_true",
        help="Mettre à jour data/declarations.json directement après --execute.",
    )
    args = parser.parse_args()

    catalog = {}
    if DEFAULT_CATALOG.exists():
        with open(DEFAULT_CATALOG, "r", encoding="utf-8") as f:
            catalog = json.load(f)

    pending = load_pending_items(args.input)
    print(f"Modules 'A_programmer' trouvés : {len(pending)}")

    if not pending:
        print("Aucun module en attente de programmation.")
        return

    planned = []
    for item in pending:
        cid = resolve_course_id(item, catalog)
        banner = build_carton_vert_html(
            item.get("module", ""),
            item.get("intervenant", ""),
            item.get("classe", ""),
        )
        planned.append(
            {
                "id": item.get("id"),
                "classe": item.get("classe"),
                "module": item.get("module"),
                "intervenant": item.get("intervenant"),
                "moodle_course_id": cid,
                "carton_vert_html": banner,
            }
        )

    if not args.execute:
        print("=== MODE SIMULATION (--dry-run) ===")
        for p in planned:
            course_url = (
                f"{MOODLE_BASE_URL}/course/view.php?id={p['moodle_course_id']}"
                if p["moodle_course_id"]
                else "Cours Moodle à associer"
            )
            print(
                f"  - [{p['id']}] {p['classe']} | {p['module']} | {p['intervenant']} -> {course_url}"
            )
        print("Ajoutez --execute --session <storage_state.json> pour exécuter sur Moodle.")
        return

    if not args.session or not args.session.exists():
        raise FileNotFoundError(
            "Le mode --execute nécessite --session <fichier_storage_state.json>."
        )

    asyncio.run(execute_playwright(planned, args.session, args.output, args.sync_local))


if __name__ == "__main__":
    main()
