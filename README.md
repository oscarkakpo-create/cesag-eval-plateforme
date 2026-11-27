# CESAG ONLINE — Mini-Plateforme d’Évaluation des Enseignements 2026-2027

Application dédiée à la planification et au suivi-évaluation des enseignements sur Moodle (`https://formations.cesagonline.com`, Catégorie `372`).

## Architecture

- **`scripts/build_catalog.py`** : Extrait les **50 programmes** et **1 843 ECUEs** depuis les 3 plaquettes officielles (`Licences`, `Masters`, `MBA`), intègre les **46 cours Moodle** de la catégorie `372` dans `public/data/` (sans aucune donnée personnelle) et initialise `data/declarations.json` avec les **35 évaluations pilotes**.
- **`server.py`** : Serveur web et API REST local (`http://127.0.0.1:8765`) avec détection des doublons (`HTTP 409`), import du tableau collègue 4 colonnes (`Modules | Intervenants | Classe | Adresse email`), export Excel multi-onglets (`.xlsx`) et export du lot prêt pour l’IA (`/api/export/pending`).
- **`public/` et `docs/`** : Interface statique aux couleurs CESAG (`#0B4D2E` / `#C9962A`), prête pour GitHub Pages, avec 3 onglets :
  1. **Déclarer des modules terminés** (`Niveau → Programme → Classe → ECUEs` + saisie intervenant/email).
  2. **Tableau de bord & Suivi** (KPI temps réel, filtres, import/export Excel, gestion des CMID et répondants).
  3. **Automatisation Moodle & Cloud** (prompt prêt pour l’IA, export JSON, réimport `resultats_moodle.json`, liaison Google Apps Script).
- **`cloud/Code.gs`** : Bridge Google Apps Script prêt à coller sur votre Google Sheet maître.
- **`scripts/program_moodle_evaluations.py`** : Script Python pour préparer et exécuter l’ouverture sur Moodle (`--dry-run` par défaut).
- **`scripts/sync_gh_pages.py`** : Synchronise `public/` vers `docs/` (avec `.nojekyll`) et vérifie qu’aucune adresse e-mail réelle ne figure dans le bundle public.

## Google Sheet Maître (Cloud Collègues)

- **Feuille privée créée :** `CESAG — Suivi Évaluations des Enseignements 26-27` (`1PVRpET7yYune0RlTYf6YBOw2IfFEP-DU5dsDqEAo5Rs`)
- **URL :** `https://docs.google.com/spreadsheets/d/1PVRpET7yYune0RlTYf6YBOw2IfFEP-DU5dsDqEAo5Rs/edit`
- **Onglets :** `Declarations` (35 évaluations pilotes pré-chargées) et `Synthese_KPI` (formules dynamiques `fr_FR`).

### Activer le pont Apps Script (2 minutes)
1. Ouvrir le Google Sheet maître → **Extensions → Apps Script**.
2. Coller le contenu de [`cloud/Code.gs`](cloud/Code.gs) dans `Code.gs` et enregistrer.
3. Cliquer sur **Déployer → Nouveau déploiement → Application Web** (`Exécuter en tant que : Moi`, `Accès : Tout le monde`), copier l’URL `/exec`.
4. Renseigner `GAS_WEB_APP_URL` dans [`public/js/config.js`](public/js/config.js), puis relancer `python scripts\sync_gh_pages.py`.

## Publication sur GitHub Pages

```powershell
# 1. Reconstruire et synchroniser docs/
python scripts\build_catalog.py
python scripts\sync_gh_pages.py

# 2. Se connecter à GitHub et pousser le dépôt (ex. cesag-eval-plateforme)
gh auth login
git init
git add .
git commit -m "CESAG Evaluations 26-27 mini-platform"
gh repo create cesag-eval-plateforme --public --source=. --push
```

Dans GitHub : **Settings → Pages → Deploy from a branch → `main` / `/docs`**.

## Lancement local

```powershell
python server.py
```

Ouvrir ensuite `http://127.0.0.1:8765` dans votre navigateur.
