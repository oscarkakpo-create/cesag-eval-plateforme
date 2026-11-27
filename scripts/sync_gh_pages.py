#!/usr/bin/env python3
"""Mirror public/ into docs/ for GitHub Pages and verify zero PII is included."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT_DIR / "public"
DOCS_DIR = ROOT_DIR / "docs"

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def main() -> None:
    if DOCS_DIR.exists():
        shutil.rmtree(DOCS_DIR)
    shutil.copytree(PUBLIC_DIR, DOCS_DIR)
    (DOCS_DIR / ".nojekyll").write_text("", encoding="utf-8")

    email_hits = []
    for path in DOCS_DIR.rglob("*"):
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in EMAIL_RE.findall(text):
            # Ignore generic form placeholder examples
            if match in ("prenom.nom@cesag.edu.sn", "intervenant@cesag.edu.sn", "jeanbaptiste.diouf@cesag.edu.sn"):
                continue
            email_hits.append((str(path.relative_to(ROOT_DIR)), match))

    if email_hits:
        raise RuntimeError(f"PII emails found in docs/: {email_hits}")

    files = [str(p.relative_to(DOCS_DIR)) for p in sorted(DOCS_DIR.rglob("*")) if p.is_file()]
    print(f"Synced public/ -> docs/ ({len(files)} files). Privacy check PASSED (0 real emails).")


if __name__ == "__main__":
    main()
