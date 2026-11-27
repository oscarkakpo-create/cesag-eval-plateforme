(() => {
  "use strict";

  const MOODLE_BASE_URL = "https://formations.cesagonline.com";
  const STORAGE_KEY_DECL = "cesag_eval_declarations_v1";
  const STORAGE_KEY_GAS = "cesag_eval_gas_url_v1";
  const STORAGE_KEY_PROFILE = "cesag_eval_declarant_v1";

  const STATUT_LABELS = {
    A_programmer: "À programmer",
    Programmee: "Programmée / Ouverte",
    Realisee: "Réalisée / Clôturée",
    Annulee: "Annulée",
  };

  const CONFIG = window.CESAG_CONFIG || {};
  const INITIAL_API_PARAM = new URLSearchParams(window.location.search).get("api") || "";

  const state = {
    mode: "static", // "local" | "cloud" | "static"
    gasUrl: INITIAL_API_PARAM || localStorage.getItem(STORAGE_KEY_GAS) || CONFIG.GAS_WEB_APP_URL || "",
    catalog: window.CESAG_CATALOG || { programs: [], moodle_courses: [], intervenants_connus: [], classes_connues: [] },
    declarations: [],
    stats: null,
    activeNiveau: "Licence",
    activeProgrammeId: "",
    activeSemestre: "ALL",
    selectedEcues: new Map(), // code -> { code, titre, semestre, ue_code, intervenant, email_intervenant, date_fin_module, observations }
    parsedImportRows: [],
  };

  const $ = (id) => document.getElementById(id);
  // Lecture seule pour les widgets d'affichage (tableau des départs)
  window.CESAG_STATE = state;

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function showToast(message, type = "info") {
    const area = $("toastArea");
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "toast-error" : type === "warn" ? "toast-warn" : ""}`;
    el.textContent = message;
    area.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 4500);
  }

  function buildCartonVertHtml(moduleName, intervenantName, _classeName) {
    const mod = escapeHtml((moduleName || "Intitulé du module").trim());
    const prof = escapeHtml((intervenantName || "Nom de l'enseignant").trim());
    return (
      `<div style="font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:0 auto;background:#ffffff;border:1px solid #E3E7E4;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.06);">` +
      `<div style="background:#0B5D3B;padding:20px 24px;color:#ffffff;">` +
      `<div style="font-size:21px;font-weight:700;line-height:1.3;">Évaluation de l’enseignement</div>` +
      `<div style="margin-top:5px;font-size:13px;color:#DDE9E2;">Votre retour contribue à l’amélioration continue de la qualité académique</div>` +
      `</div>` +
      `<div style="padding:24px;color:#1A2B23;font-size:15px;line-height:1.65;">` +
      `<p style="margin:0 0 14px 0;">Chers étudiants,</p>` +
      `<p style="margin:0 0 16px 0;">Nous vous invitons à bien vouloir procéder à l’évaluation du module : <strong>${mod}</strong> (Enseignant : <strong>${prof}</strong>). Votre appréciation nous permet de mieux comprendre votre expérience et d’identifier les axes d’amélioration.</p>` +
      `<div style="background:#F5F7F6;border-left:4px solid #B7862A;padding:14px 16px;margin:18px 0;border-radius:6px;">` +
      `<strong style="color:#0B5D3B;">Confidentialité des réponses</strong><br>` +
      `Cette évaluation n’est pas anonyme afin de nous permettre de nous assurer de la participation de tous. Les réponses sont toutefois traitées de manière confidentielle.` +
      `</div>` +
      `<p style="margin:0;">Nous vous remercions de répondre avec sincérité, objectivité et responsabilité.</p>` +
      `</div>` +
      `<div style="background:#F5F7F6;padding:13px 24px;border-top:1px solid #E3E7E4;color:#5A6862;font-size:12px;">` +
      `CESAG – Amélioration continue de la qualité des enseignements` +
      `</div></div>`
    );
  }

  function computeStats(items) {
    const active = items.filter((x) => x.statut !== "Annulee");
    const a_programmer = items.filter((x) => x.statut === "A_programmer").length;
    const programmee = items.filter((x) => x.statut === "Programmee").length;
    const realisee = items.filter((x) => x.statut === "Realisee").length;
    const annul = items.filter((x) => x.statut === "Annulee").length;
    const progPlus = programmee + realisee;
    const totalActives = active.length;
    // Objectif annuel global de programmation (1 665 évaluations prévues dans la maquette Catégorie 372)
    const TOTAL_ANNUEL_PREVU = 1665;
    const taux_programmation = Math.round((progPlus / TOTAL_ANNUEL_PREVU) * 1000) / 10;
    const taux_realisation = progPlus ? Math.round((realisee / progPlus) * 1000) / 10 : 0;
    const total_repondants = items.reduce((acc, x) => acc + (Number(x.nb_repondants) || 0), 0);

    const par_niveau = {};
    ["Master", "MBA"].forEach((niv) => {
      const sub = items.filter((x) => x.niveau === niv);
      par_niveau[niv] = {
        total: sub.length,
        a_programmer: sub.filter((x) => x.statut === "A_programmer").length,
        programmee: sub.filter((x) => x.statut === "Programmee").length,
        realisee: sub.filter((x) => x.statut === "Realisee").length,
      };
    });

    return {
      total: items.length,
      total_annuel: TOTAL_ANNUEL_PREVU,
      total_actives: totalActives,
      a_programmer,
      programmee,
      realisee,
      annulee: annul,
      programmee_ou_plus: progPlus,
      taux_programmation,
      taux_realisation,
      total_repondants,
      par_niveau,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Storage & API Abstraction (Local Server / GAS Cloud / Static LS)   */
  /* ------------------------------------------------------------------ */
  async function detectBackend() {
    if (state.gasUrl) {
      try {
        const res = await fetch(`${state.gasUrl}${state.gasUrl.includes("?") ? "&" : "?"}action=list`);
        if (res.ok) {
          const data = await res.json();
          state.mode = "cloud";
          state.declarations = Array.isArray(data.declarations) ? data.declarations : [];
          updateStorageBadge();
          return;
        }
      } catch (_err) {
        showToast("URL Google Apps Script inaccessible ; bascule sur le stockage local.", "warn");
      }
    }

    try {
      const health = await fetch("/api/health", { cache: "no-store" });
      if (health.ok) {
        state.mode = "local";
        await loadFromServer();
        updateStorageBadge();
        return;
      }
    } catch (_err) {
      // Not served by server.py
    }

    state.mode = "static";
    const saved = localStorage.getItem(STORAGE_KEY_DECL);
    state.declarations = saved ? JSON.parse(saved) : [];
    updateStorageBadge();
  }

  async function loadFromServer() {
    if (state.mode === "local") {
      const [catRes, declRes] = await Promise.all([
        fetch("/api/catalog", { cache: "no-store" }),
        fetch("/api/declarations", { cache: "no-store" }),
      ]);
      if (catRes.ok) {
        state.catalog = await catRes.json();
      }
      if (declRes.ok) {
        const payload = await declRes.json();
        state.declarations = payload.declarations || [];
        state.stats = payload.stats || computeStats(state.declarations);
      }
    } else if (state.mode === "cloud") {
      const res = await fetch(`${state.gasUrl}${state.gasUrl.includes("?") ? "&" : "?"}action=list`);
      const payload = await res.json();
      state.declarations = payload.declarations || [];
      state.stats = computeStats(state.declarations);
    } else {
      localStorage.setItem(STORAGE_KEY_DECL, JSON.stringify(state.declarations));
      state.stats = computeStats(state.declarations);
    }
  }

  function updateStorageBadge() {
    const badge = $("storageBadge");
    const label = $("storageBadgeText");
    badge.className = "storage-badge";
    if (state.mode === "cloud") {
      badge.classList.add("mode-cloud");
      label.textContent = "Cloud Google Sheets";
    } else if (state.mode === "local") {
      badge.classList.add("mode-local");
      label.textContent = "Serveur Local Python";
    } else {
      badge.classList.add("mode-static");
      label.textContent = "Mode Navigateur";
    }
  }

  async function apiCreateDeclarations(items, force = false) {
    if (state.mode === "local") {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || data.error || "Erreur serveur");
        err.status = res.status;
        err.data = data;
        throw err;
      }
      await loadFromServer();
      return data;
    }

    if (state.mode === "cloud") {
      const res = await fetch(state.gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "submit", items, force }),
      });
      const data = await res.json();
      if (data.error) {
        const err = new Error(data.message || data.error);
        err.status = data.status || 409;
        err.data = data;
        throw err;
      }
      await loadFromServer();
      return data;
    }

    // Static fallback
    const activeSet = new Set(
      state.declarations
        .filter((x) => x.statut !== "Annulee")
        .map((x) => `${normalizeText(x.classe)}||${normalizeText(x.module)}`)
    );
    const duplicates = [];
    const added = [];
    const ts = new Date().toISOString();
    let maxNum = state.declarations.reduce((m, x) => {
      const match = String(x.id || "").match(/EVAL-2627-(\d+)/);
      return match ? Math.max(m, Number(match[1])) : m;
    }, 0);

    for (const entry of items) {
      const key = `${normalizeText(entry.classe)}||${normalizeText(entry.module)}`;
      if (activeSet.has(key) && !force) {
        duplicates.push({ classe: entry.classe, module: entry.module });
        continue;
      }
      maxNum += 1;
      added.push({
        id: `EVAL-2627-${String(maxNum).padStart(4, "0")}`,
        statut: "A_programmer",
        cmid: "",
        lien_moodle: "",
        date_ouverture: "",
        date_cloture: "",
        nb_repondants: null,
        source: "mini_plateforme",
        created_at: ts,
        updated_at: ts,
        ...entry,
      });
    }
    if (duplicates.length && !force) {
      const err = new Error(`${duplicates.length} doublon(s) détecté(s)`);
      err.status = 409;
      err.data = { duplicates };
      throw err;
    }
    state.declarations.push(...added);
    await loadFromServer();
    return { added: added.length, items: added };
  }

  async function apiUpdateDeclaration(id, patch) {
    if (state.mode === "local") {
      const res = await fetch(`/api/declarations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour");
      await loadFromServer();
      return data;
    }

    if (state.mode === "cloud") {
      const res = await fetch(state.gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "update", id, patch }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await loadFromServer();
      return data;
    }

    const idx = state.declarations.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error("Introuvable");
    const target = { ...state.declarations[idx], ...patch, updated_at: new Date().toISOString() };
    if (target.cmid && !target.lien_moodle) {
      target.lien_moodle = `${MOODLE_BASE_URL}/mod/feedback/view.php?id=${target.cmid}`;
    }
    state.declarations[idx] = target;
    await loadFromServer();
    return { item: target };
  }

  async function apiDeleteDeclaration(id) {
    if (state.mode === "local") {
      const res = await fetch(`/api/declarations/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur suppression");
      await loadFromServer();
      return;
    }

    if (state.mode === "cloud") {
      await fetch(state.gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "delete", id }),
      });
      await loadFromServer();
      return;
    }

    state.declarations = state.declarations.filter((x) => x.id !== id);
    await loadFromServer();
  }

  /* ------------------------------------------------------------------ */
  /* Tab 1: Catalog & Multi-Select Declaration Builder                  */
  /* ------------------------------------------------------------------ */
  // Rattachement des filières aux directions :
  // DPECN = MBA + toute la filière comptable DECOGEF / DESCOGEF ; DPGELM = le reste.
  function programDirection(p) {
    const key = `${p.id || ""} ${p.code || ""}`.toUpperCase();
    if (p.niveau === "MBA" || key.includes("COGEF")) return "DPECN";
    return "DPGELM";
  }

  function getActiveDirection() {
    const dirSel = $("directionFilterSelect");
    return (dirSel && dirSel.value) || state.activeDirection || "ALL";
  }

  function getProgramsByNiveau(niveau) {
    const query = normalizeText($("programmeSearch").value);
    const dir = getActiveDirection();
    return (state.catalog.programs || []).filter((p) => {
      if (niveau && p.niveau !== niveau) return false;
      if (dir !== "ALL" && programDirection(p) !== dir) return false;
      if (!query) return true;
      return (
        normalizeText(p.code).includes(query) ||
        normalizeText(p.titre).includes(query)
      );
    });
  }

  function getSelectedProgram() {
    return (state.catalog.programs || []).find((p) => p.id === state.activeProgrammeId) || null;
  }

  function renderNiveauPills() {
    const container = $("niveauPills");
    const dirSel = $("directionFilterSelect");
    const activeDir = dirSel ? dirSel.value : (state.activeDirection || "ALL");

    let levels = ["Licence", "Master", "MBA"];
    if (activeDir === "DPGELM") {
      levels = ["Licence", "Master"];
    } else if (activeDir === "DPECN") {
      levels = ["MBA", "Licence", "Master"]; // MBA + DECOGEF (Licence) + DESCOGEF (Master)
    }

    if (!levels.includes(state.activeNiveau)) {
      state.activeNiveau = levels[0];
    }

    container.innerHTML = levels
      .map((niv) => {
        const info = state.catalog.summary?.by_niveau?.[niv] || {};
        let countProg = info.programmes || (state.catalog.programs || []).filter((p) => p.niveau === niv).length;
        let countEcue = info.ecues || 0;
        if (activeDir === "DPGELM" || activeDir === "DPECN") {
          const scoped = (state.catalog.programs || []).filter((p) => p.niveau === niv && programDirection(p) === activeDir);
          countProg = scoped.length;
          countEcue = scoped.reduce((acc, p) => acc + (Number(p.ecue_count) || 0), 0);
        }
        const active = state.activeNiveau === niv ? "active" : "";
        const icon = niv === "Licence" ? "📘" : (niv === "Master" ? "🎓" : "💼");
        return `
          <button class="pill-btn ${active}" type="button" data-niveau="${niv}">
            <span>${icon} ${niv}</span>
            <span class="pill-sub">${countProg} filière${countProg > 1 ? "s" : ""} · ${countEcue} ECUEs</span>
          </button>
        `;
      })
      .join("");

    container.querySelectorAll("[data-niveau]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeNiveau = btn.dataset.niveau;
        state.activeProgrammeId = "";
        state.activeSemestre = "ALL";
        renderNiveauPills();
        renderProgramSelect(false);
      });
    });
  }

  function renderProgramSelect(preserveCurrent = false) {
    const list = getProgramsByNiveau(state.activeNiveau);
    const sel = $("programmeSelect");
    $("programmeCountLabel").textContent = String(list.length);

    if (!list.length) {
      sel.innerHTML = `<option value="">Aucune filière trouvée</option>`;
      state.activeProgrammeId = "";
      renderClasseSuggestions();
      renderSemestrePills();
      renderEcueChecklist();
      return;
    }

    if (!preserveCurrent || !list.some((p) => p.id === state.activeProgrammeId)) {
      state.activeProgrammeId = "";
    }

    const placeholder = `<option value="" ${!state.activeProgrammeId ? "selected" : ""}>-- Choisissez votre filière / programme (${list.length} disponibles) --</option>`;

    sel.innerHTML =
      placeholder +
      list
        .map((p) => {
          const selected = p.id === state.activeProgrammeId ? "selected" : "";
          return `<option value="${escapeHtml(p.id)}" ${selected}>${escapeHtml(p.code)} — ${escapeHtml(p.titre)} (${p.ecue_count} cours)</option>`;
        })
        .join("");

    renderClasseSuggestions(Boolean(state.activeProgrammeId));
    renderSemestrePills();
    renderEcueChecklist();
  }

  function renderClasseSuggestions(prefillIfEmpty = false) {
    const prog = getSelectedProgram();
    const container = $("classeSuggestions");

    if (!prog) {
      $("classeInput").value = "";
      $("classeInput").placeholder = "Sélectionnez d'abord une filière ci-dessus…";
      container.innerHTML = `<div class="muted-small" style="padding:4px 0;">Sélectionnez une filière ci-dessus pour afficher ses cohortes officielles Moodle.</div>`;
      return;
    }

    $("classeInput").placeholder = "Sélectionnez ou cliquez sur l'intitulé officiel ci-dessous…";
    const suggestions = prog?.classes_suggerees || [];

    if (prefillIfEmpty && suggestions.length) {
      const currentVal = $("classeInput").value.trim();
      const belongsToCurrent = suggestions.some((s) => normalizeText(s) === normalizeText(currentVal));
      if (!currentVal || !belongsToCurrent) {
        $("classeInput").value = suggestions[0];
      }
    }

    const activeClass = normalizeText($("classeInput").value);
    container.innerHTML = suggestions
      .map((cls) => {
        const isAct = normalizeText(cls) === activeClass ? "active" : "";
        return `<button class="chip-btn ${isAct}" type="button" data-suggest-classe="${escapeHtml(cls)}">${escapeHtml(cls)}</button>`;
      })
      .join("");

    container.querySelectorAll("[data-suggest-classe]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $("classeInput").value = btn.dataset.suggestClasse;
        renderClasseSuggestions(false);
        renderEcueChecklist();
        renderSelectedModules();
      });
    });
  }

  function renderSemestrePills() {
    const prog = getSelectedProgram();
    const container = $("semestrePills");
    if (!prog) {
      container.innerHTML = "";
      return;
    }
    const sems = prog.semestres || [];
    if (state.activeSemestre !== "ALL" && !sems.includes(state.activeSemestre)) {
      state.activeSemestre = "ALL";
    }

    const pills = [{ key: "ALL", label: "Tous" }, ...sems.map((s) => ({ key: s, label: s }))];
    container.innerHTML = pills
      .map((item) => {
        const active = state.activeSemestre === item.key ? "active" : "";
        return `<button class="pill-btn ${active}" type="button" data-sem="${escapeHtml(item.key)}">${escapeHtml(item.label)}</button>`;
      })
      .join("");

    container.querySelectorAll("[data-sem]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeSemestre = btn.dataset.sem;
        renderSemestrePills();
        renderEcueChecklist();
      });
    });
  }

  function getFilteredEcues() {
    const prog = getSelectedProgram();
    if (!prog) return [];
    const q = normalizeText($("moduleSearchInput").value);
    return (prog.ecues || []).filter((e) => {
      if (state.activeSemestre !== "ALL" && e.semestre !== state.activeSemestre) return false;
      if (!q) return true;
      return (
        normalizeText(e.code).includes(q) ||
        normalizeText(e.titre).includes(q) ||
        normalizeText(e.ue_titre).includes(q)
      );
    });
  }

  function findExistingDeclarationForClass(classe, moduleTitle) {
    const clsNorm = normalizeText(classe);
    const modNorm = normalizeText(moduleTitle);
    if (!clsNorm || !modNorm) return null;
    return state.declarations.find(
      (d) =>
        d.statut !== "Annulee" &&
        normalizeText(d.classe) === clsNorm &&
        normalizeText(d.module) === modNorm
    ) || null;
  }

  function renderEcueChecklist() {
    const container = $("ecueChecklist");
    const prog = getSelectedProgram();

    if (!prog) {
      $("ecueStatsLabel").textContent = "";
      container.innerHTML = `
        <div class="empty-selection" style="padding:48px 16px;text-align:center;">
          <div style="font-size:36px;margin-bottom:10px;">👆</div>
          <p style="font-size:15px;font-weight:700;color:var(--cesag-green-dark);margin-bottom:6px;">Choisissez votre filière dans la liste ci-dessus</p>
          <p class="muted-small" style="max-width:420px;margin:0 auto;line-height:1.5;">
            Sélectionnez votre programme (ex : MACG, MCGF, MBF, MBA…) pour afficher directement ses cohortes officielles Moodle et ses modules à cocher.
          </p>
        </div>
      `;
      return;
    }

    const ecues = getFilteredEcues();
    const currentClasse = $("classeInput").value.trim();

    $("ecueStatsLabel").textContent = `${ecues.length} ECUE(s) affiché(s) sur ${prog.ecue_count}`;

    if (!ecues.length) {
      container.innerHTML = `<div class="empty-table">Aucun ECUE trouvé pour ce filtre.</div>`;
      return;
    }

    // Group by UE
    const groups = new Map();
    ecues.forEach((e) => {
      const groupKey = `${e.semestre} :: ${e.ue_code} — ${e.ue_titre || "UE"}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(e);
    });

    let html = "";
    groups.forEach((items, header) => {
      const [semPart, uePart] = header.split(" :: ");
      html += `<div class="ue-group-header"><span>${escapeHtml(uePart)}</span><span>${escapeHtml(semPart)}</span></div>`;
      items.forEach((e) => {
        const key = `${prog.id}::${e.code}`;
        const isSelected = state.selectedEcues.has(key);
        const existing = findExistingDeclarationForClass(currentClasse, e.titre);
        const existingBadge = existing
          ? `<span class="status-badge status-${escapeHtml(existing.statut)}">${escapeHtml(STATUT_LABELS[existing.statut] || existing.statut)}</span>`
          : "";
        const hoursInfo = e.total_h ? `${e.total_h}h` : "";
        html += `
          <button type="button" class="ecue-item ecue-quick" data-quick-code="${escapeHtml(e.code)}">
            <div class="ecue-item-body">
              <div class="ecue-item-top">
                <span class="ecue-code">${escapeHtml(e.code)}</span>
                <span class="ecue-title">${escapeHtml(e.titre)}</span>
                ${existingBadge}
              </div>
              <div class="ecue-meta">
                <span>${escapeHtml(e.annee || "")}</span>
                ${hoursInfo ? `<span>Volume : ${hoursInfo}</span>` : ""}
                ${e.cm ? `<span>CM ${e.cm}h</span>` : ""}
                ${e.td_tp ? `<span>TD ${e.td_tp}h</span>` : ""}
              </div>
            </div>
            ${existing
              ? `<span class="ecue-quick-cta is-done">${SYM.checkFill}<span>Signalé</span></span>`
              : `<span class="ecue-quick-cta">${SYM.check}<span>Terminé</span></span>`}
          </button>
        `;
      });
    });

    container.innerHTML = html;
    container.querySelectorAll("[data-quick-code]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ecue = ecues.find((item) => item.code === btn.dataset.quickCode);
        if (ecue) openQuickDeclare(prog, ecue);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Déclaration rapide par boîtes de dialogue :                          */
  /* Terminé ? Oui/Non → Nom du prof → Êtes-vous sûr ? → Envoyé           */
  /* ------------------------------------------------------------------ */
  // Symboles façon Apple (traits arrondis, cercle + glyphe)
  const SVG_OPEN = '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const SYM = {
    check: `${SVG_OPEN}<circle cx="12" cy="12" r="9"/><path d="m8.2 12.4 2.6 2.6 5-5.3"/></svg>`,
    checkFill: `${SVG_OPEN}<circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none"/><path d="m8.2 12.4 2.6 2.6 5-5.3" stroke="#fff" stroke-width="2.2"/></svg>`,
    question: `${SVG_OPEN}<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.5"/><circle cx="12" cy="16.9" r="1" fill="currentColor" stroke="none"/></svg>`,
    person: `${SVG_OPEN}<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="2.8"/><path d="M7 17.6a5.8 5.8 0 0 1 10 0"/></svg>`,
    alert: `${SVG_OPEN}<circle cx="12" cy="12" r="9"/><path d="M12 7.6v5.4"/><circle cx="12" cy="16.4" r="1" fill="currentColor" stroke="none"/></svg>`,
    xmark: `${SVG_OPEN}<circle cx="12" cy="12" r="9"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/></svg>`,
    yes: `${SVG_OPEN}<path d="m5.5 12.5 4.2 4.2 8.8-9.4" stroke-width="2.2"/></svg>`,
    no: `${SVG_OPEN}<path d="m7 7 10 10M17 7 7 17" stroke-width="2.2"/></svg>`,
    send: `${SVG_OPEN}<path d="M21 3 10.5 13.5"/><path d="m21 3-6.5 18-4-7.5L3 9.5z"/></svg>`,
  };

  function ensureQuickModal() {
    let modal = $("quickDeclareModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "quickDeclareModal";
    modal.className = "qd-backdrop hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "qdTitle");
    modal.innerHTML = `<div class="qd-card"><div class="qd-icon" id="qdIcon"></div><p class="qd-kicker" id="qdKicker"></p><h3 id="qdTitle"></h3><div id="qdBody"></div><div class="qd-actions" id="qdActions"></div></div>`;
    modal.addEventListener("click", (ev) => {
      if (ev.target === modal && !modal.dataset.busy) closeQuickModal();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !modal.classList.contains("hidden") && !modal.dataset.busy) closeQuickModal();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function closeQuickModal() {
    const modal = $("quickDeclareModal");
    if (modal) {
      modal.classList.add("hidden");
      delete modal.dataset.busy;
    }
  }

  function showQuickStep({ icon, tone, kicker, title, body, actions }) {
    const modal = ensureQuickModal();
    const iconBox = $("qdIcon");
    iconBox.className = `qd-icon qd-${tone || "green"}`;
    iconBox.innerHTML = icon || "";
    iconBox.hidden = !icon;
    $("qdKicker").textContent = kicker || "";
    $("qdTitle").textContent = title || "";
    $("qdBody").innerHTML = body || "";
    const box = $("qdActions");
    box.innerHTML = "";
    (actions || []).forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn ${a.primary ? "btn-primary" : "btn-outline"}`;
      b.innerHTML = `${a.sym ? SYM[a.sym] : ""}<span>${escapeHtml(a.label)}</span>`;
      b.addEventListener("click", a.onClick);
      box.appendChild(b);
    });
    modal.classList.remove("hidden");
    const focusEl = modal.querySelector("input") || box.querySelector(".btn-primary") || box.querySelector("button");
    setTimeout(() => focusEl && focusEl.focus(), 50);
  }

  function openQuickDeclare(prog, ecue) {
    const classe = $("classeInput").value.trim();
    if (!classe) {
      showQuickStep({
        icon: SYM.alert, tone: "amber",
        kicker: ecue.titre,
        title: "Choisissez d'abord votre cohorte",
        body: `<p class="qd-text">Sélectionnez la cohorte (classe) au-dessus de la liste des modules, puis recliquez sur le module.</p>`,
        actions: [{ label: "OK", primary: true, onClick: () => { closeQuickModal(); $("classeInput").focus(); } }],
      });
      return;
    }
    const existing = findExistingDeclarationForClass(classe, ecue.titre);
    showQuickStep({
      icon: SYM.question, tone: "blue",
      kicker: classe,
      title: `${ecue.titre} : ce cours est-il terminé ?`,
      body: existing
        ? `<p class="qd-warn">Déjà déclaré pour cette cohorte (${escapeHtml(STATUT_LABELS[existing.statut] || existing.statut)}).</p>`
        : "",
      actions: [
        { label: "Non", sym: "no", onClick: closeQuickModal },
        { label: "Oui", sym: "yes", primary: true, onClick: () => askProf(prog, ecue, classe, "") },
      ],
    });
  }

  function askProf(prog, ecue, classe, current) {
    showQuickStep({
      icon: SYM.person, tone: "green",
      kicker: ecue.titre,
      title: "Nom du prof",
      body: `<input id="qdProf" class="input" type="text" list="intervenantsDatalist" placeholder="Ex : M. Diouf" value="${escapeHtml(current)}" autocomplete="off" aria-label="Nom du prof">`,
      actions: [
        { label: "Annuler", onClick: closeQuickModal },
        {
          label: "Valider",
          sym: "yes",
          primary: true,
          onClick: () => {
            const inp = $("qdProf");
            const prof = (inp.value || "").trim();
            if (!prof) {
              inp.classList.add("qd-invalid");
              inp.focus();
              return;
            }
            confirmQuick(prog, ecue, classe, prof);
          },
        },
      ],
    });
    $("qdProf").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        $("qdActions").querySelector(".btn-primary").click();
      }
    });
  }

  function confirmQuick(prog, ecue, classe, prof, force = false) {
    showQuickStep({
      icon: SYM.alert, tone: "amber",
      kicker: "Confirmation",
      title: "Êtes-vous sûr ?",
      body: `<p class="qd-text"><strong>${escapeHtml(ecue.titre)}</strong><br>${escapeHtml(classe)} · Prof : ${escapeHtml(prof)}</p>`,
      actions: [
        { label: "Non", sym: "no", onClick: () => askProf(prog, ecue, classe, prof) },
        { label: "Oui, envoyer", sym: "send", primary: true, onClick: () => sendQuick(prog, ecue, classe, prof, force) },
      ],
    });
  }

  async function sendQuick(prog, ecue, classe, prof, force) {
    showQuickStep({ kicker: ecue.titre, title: "Envoi en cours…", body: `<div class="qd-spinner" aria-hidden="true"></div>`, actions: [] });
    const modal = ensureQuickModal();
    modal.dataset.busy = "1";
    let profile = {};
    try {
      profile = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILE) || "{}");
    } catch (_e) {
      profile = {};
    }
    const declarant_nom = ($("declarantNom")?.value || "").trim() || profile.declarant_nom || "Responsable de programme";
    const declarant_email = ($("declarantEmail")?.value || "").trim() || profile.declarant_email || "";
    const lecturer = getKnownLecturers().find((l) => normalizeText(l.nom) === normalizeText(prof));
    const dateOuv = $("defaultDateOuverture")?.value || todayIso();
    const item = {
      niveau: prog.niveau,
      programme: prog.code,
      semestre: ecue.semestre,
      classe,
      code_ecue: ecue.code,
      module: ecue.titre,
      intervenant: prof,
      email_intervenant: (lecturer && lecturer.email) || "",
      date_ouverture: dateOuv,
      date_cloture: $("defaultDateCloture")?.value || "",
      date_fin_module: dateOuv,
      declarant_nom,
      declarant_email,
      observations: "",
      source: "formulaire_collegue",
    };
    try {
      await apiCreateDeclarations([item], force);
      delete modal.dataset.busy;
      triggerFlightTakeoff();
      renderAll();
      showQuickStep({
        icon: SYM.checkFill, tone: "green qd-pop",
        kicker: "C'est parti",
        title: "C'est envoyé",
        body: `<p class="qd-text">L'évaluation de <strong>${escapeHtml(ecue.titre)}</strong> va être programmée sur Moodle.</p>`,
        actions: [{ label: "OK", primary: true, onClick: closeQuickModal }],
      });
    } catch (err) {
      delete modal.dataset.busy;
      if (err.status === 409) {
        showQuickStep({
          icon: SYM.alert, tone: "amber",
          kicker: ecue.titre,
          title: "Déjà déclaré pour cette cohorte",
          body: `<p class="qd-text">Voulez-vous l'envoyer quand même ?</p>`,
          actions: [
            { label: "Non", sym: "no", onClick: closeQuickModal },
            { label: "Oui", sym: "yes", primary: true, onClick: () => sendQuick(prog, ecue, classe, prof, true) },
          ],
        });
      } else {
        showQuickStep({
          icon: SYM.xmark, tone: "red",
          kicker: ecue.titre,
          title: "L'envoi n'a pas abouti",
          body: `<p class="qd-text">${escapeHtml(err.message || "Erreur réseau")}. Réessayez dans un instant.</p>`,
          actions: [
            { label: "Fermer", onClick: closeQuickModal },
            { label: "Réessayer", primary: true, onClick: () => sendQuick(prog, ecue, classe, prof, force) },
          ],
        });
      }
    }
  }

  function addSelectedEcue(prog, ecue) {
    const key = `${prog.id}::${ecue.code}`;
    if (state.selectedEcues.has(key)) return;
    const dateOuv = $("defaultDateOuverture")?.value || todayIso();
    const dateClot = $("defaultDateCloture")?.value || "";
    state.selectedEcues.set(key, {
      key,
      niveau: prog.niveau,
      programme: prog.code,
      semestre: ecue.semestre,
      code_ecue: ecue.code,
      module: ecue.titre,
      intervenant: "",
      email_intervenant: "",
      date_ouverture: dateOuv,
      date_cloture: dateClot,
      date_fin_module: dateOuv,
      observations: "",
    });
  }

  function getKnownLecturers() {
    const map = new Map();
    (state.catalog.intervenants_connus || []).forEach((x) => {
      if (x.nom) map.set(normalizeText(x.nom), { nom: x.nom, email: x.email || "" });
    });
    state.declarations.forEach((d) => {
      if (d.intervenant) {
        const k = normalizeText(d.intervenant);
        if (!map.has(k) || (d.email_intervenant && !map.get(k).email)) {
          map.set(k, { nom: d.intervenant, email: d.email_intervenant || "" });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }

  function renderDatalists() {
    const lecturers = getKnownLecturers();
    $("intervenantsDatalist").innerHTML = lecturers
      .map((l) => `<option value="${escapeHtml(l.nom)}">${l.email ? escapeHtml(l.email) : ""}</option>`)
      .join("");

    const classes = new Set(state.catalog.classes_connues || []);
    state.declarations.forEach((d) => {
      if (d.classe) classes.add(d.classe);
    });
    $("classesDatalist").innerHTML = Array.from(classes)
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((c) => `<option value="${escapeHtml(c)}">`)
      .join("");
  }

  function renderSelectedModules() {
    const container = $("selectedModulesContainer");
    const items = Array.from(state.selectedEcues.values());
    const count = items.length;
    const currentClasse = $("classeInput").value.trim();

    $("selectedCountBadge").textContent = String(count);
    const isCockpit = document.body.classList.contains("mode-cockpit");
    $("btnSubmitDeclarations").textContent = isCockpit ? `🛫 Autorisation de décollage · Transmettre signal (${count} module${count > 1 ? "s" : ""})` : `🚀 Envoyer le signal pour programmation (${count} module${count > 1 ? "s" : ""})`;
    $("btnSubmitDeclarations").disabled = count === 0;

    if (!count) {
      $("duplicateWarningBanner").classList.add("hidden");
      container.innerHTML = `
        <div class="empty-selection">
          <div class="empty-icon">☑</div>
          <p><strong>Aucun module sélectionné</strong></p>
          <p class="muted-small">Cochez un ou plusieurs ECUEs à gauche pour renseigner les intervenants et les envoyer à la programmation.</p>
        </div>
      `;
      return;
    }

    const dupNames = [];
    const lecturers = getKnownLecturers();
    const lecturerEmailLookup = new Map(lecturers.map((l) => [normalizeText(l.nom), l.email]));

    container.innerHTML = items
      .map((item) => {
        const existing = findExistingDeclarationForClass(currentClasse, item.module);
        if (existing) dupNames.push(`${item.module} (${STATUT_LABELS[existing.statut] || existing.statut})`);
        return `
          <div class="selected-module-card ${existing ? "is-duplicate" : ""}" data-card-key="${escapeHtml(item.key)}">
            <div class="selected-card-head">
              <div>
                <span class="ecue-code">${escapeHtml(item.code_ecue)}</span>
                <span class="selected-card-title">${escapeHtml(item.module)}</span>
                ${existing ? `<div class="cell-sub" style="color:#B45309;">Déjà enregistré pour ${escapeHtml(currentClasse)} : ${escapeHtml(STATUT_LABELS[existing.statut] || existing.statut)}</div>` : ""}
              </div>
              <button class="btn btn-xs btn-danger-soft" type="button" data-remove-key="${escapeHtml(item.key)}">Retirer</button>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Intervenant <span class="muted-small">(ex : M. Diouf)</span></label>
                <input class="input input-sm" type="text" list="intervenantsDatalist" data-field="intervenant" data-key="${escapeHtml(item.key)}" value="${escapeHtml(item.intervenant)}" placeholder="Nom de l'enseignant (ou laisser vide)">
              </div>
              <div class="form-group">
                <label class="form-label">Email intervenant <span class="muted-small">(facultatif)</span></label>
                <input class="input input-sm" type="email" data-field="email_intervenant" data-key="${escapeHtml(item.key)}" value="${escapeHtml(item.email_intervenant)}" placeholder="Optionnel">
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Date début programmation (ouverture)</label>
                <input class="input input-sm" type="date" data-field="date_ouverture" data-key="${escapeHtml(item.key)}" value="${escapeHtml(item.date_ouverture || todayIso())}">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Date de clôture <span class="muted-small">(facultatif)</span></label>
                <input class="input input-sm" type="date" data-field="date_cloture" data-key="${escapeHtml(item.key)}" value="${escapeHtml(item.date_cloture || '')}">
              </div>
            </div>
            <div class="form-group" style="margin-top:6px;margin-bottom:0;">
              <label class="form-label">Note / Observation <span class="muted-small">(facultatif)</span></label>
              <input class="input input-sm" type="text" data-field="observations" data-key="${escapeHtml(item.key)}" value="${escapeHtml(item.observations)}" placeholder="Ex : cours achevé, évaluation demandée">
            </div>
          </div>
        `;
      })
      .join("");

    const warnBanner = $("duplicateWarningBanner");
    if (dupNames.length) {
      warnBanner.classList.remove("hidden");
      warnBanner.innerHTML = `<strong>Attention :</strong> ${dupNames.length} module(s) déjà présent(s) pour la classe <strong>${escapeHtml(currentClasse)}</strong> (${escapeHtml(dupNames.join(", "))}). Cochez « Autoriser si déjà présent » pour confirmer un nouvel envoi.`;
    } else {
      warnBanner.classList.add("hidden");
    }

    container.querySelectorAll("[data-remove-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedEcues.delete(btn.dataset.removeKey);
        renderEcueChecklist();
        renderSelectedModules();
      });
    });

    container.querySelectorAll("input[data-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const entry = state.selectedEcues.get(inp.dataset.key);
        if (!entry) return;
        const field = inp.dataset.field;
        entry[field] = inp.value;
        if (field === "intervenant") {
          const autoEmail = lecturerEmailLookup.get(normalizeText(inp.value));
          if (autoEmail && !entry.email_intervenant) {
            entry.email_intervenant = autoEmail;
            const emailInput = container.querySelector(
              `input[data-field="email_intervenant"][data-key="${CSS.escape(inp.dataset.key)}"]`
            );
            if (emailInput) emailInput.value = autoEmail;
          }
        }
      });
    });
  }

  async function handleSubmitDeclarations() {
    const classe = $("classeInput").value.trim();
    if (!classe) {
      showToast("Veuillez préciser la classe / cohorte.", "error");
      $("classeInput").focus();
      return;
    }
    const items = Array.from(state.selectedEcues.values());
    if (!items.length) return;

    const declarant_nom = $("declarantNom").value.trim() || "Responsable de programme";
    const declarant_email = $("declarantEmail").value.trim();
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify({ declarant_nom, declarant_email }));

    const payloadItems = items.map((x) => ({
      niveau: x.niveau,
      programme: x.programme,
      semestre: x.semestre,
      classe,
      code_ecue: x.code_ecue,
      module: x.module,
      intervenant: x.intervenant.trim() || "Enseignant à préciser",
      email_intervenant: x.email_intervenant.trim(),
      date_ouverture: x.date_ouverture || $("defaultDateOuverture")?.value || todayIso(),
      date_cloture: x.date_cloture || $("defaultDateCloture")?.value || "",
      date_fin_module: x.date_ouverture || $("defaultDateOuverture")?.value || todayIso(),
      declarant_nom,
      declarant_email,
      observations: x.observations.trim(),
      source: "formulaire_collegue",
    }));

    const force = $("forceDuplicateCheck").checked;
    try {
      const res = await apiCreateDeclarations(payloadItems, force);
      triggerFlightTakeoff();
      const isCockpit = document.body.classList.contains("mode-cockpit");
      const msg = isCockpit
        ? `🛫 Vol autorisé 5/5 : ${res.added || payloadItems.length} module(s) transmis à la Tour de Contrôle Oscar Kakpo !`
        : `${res.added || payloadItems.length} module(s) enregistré(s) dans « À programmer » !`;
      showToast(msg);
      state.selectedEcues.clear();
      $("forceDuplicateCheck").checked = false;
      renderAll();
    } catch (err) {
      if (err.status === 409) {
        showToast("Doublon détecté pour cette classe. Cochez la case ou retirez le module déjà programmé.", "warn");
      } else {
        showToast(err.message || "Erreur lors de l'enregistrement", "error");
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Tab 2: Dashboard, KPIs, Filters, Edit & Import/Export              */
  /* ------------------------------------------------------------------ */
  function renderDashboard() {
    const stats = state.stats || computeStats(state.declarations);
    $("kpiTotal").textContent = String(stats.total);
    if ($("kpiTotalSub")) $("kpiTotalSub").textContent = "35 modules actifs (Licence exclue)";
    $("kpiPending").textContent = String(stats.a_programmer);
    $("kpiProgrammed").textContent = String(stats.programmee);
    $("kpiDone").textContent = String(stats.realisee);
    $("kpiDoneSub").textContent = `${stats.total_repondants} répondants enregistrés`;
    $("kpiRate").textContent = `${stats.taux_programmation}%`;
    $("kpiRateBar").style.width = `${Math.min(100, Math.max(3, stats.taux_programmation))}%`;
    $("kpiRealRateSub").textContent = `${stats.programmee_ou_plus} / ${stats.total_annuel} prévues (${stats.taux_programmation}%) · ${stats.realisee} clôturées (${stats.taux_realisation}%)`;

    $("badgeTotalCount").textContent = String(stats.total);
    $("badgePendingCount").textContent = String(stats.a_programmer);

    // Synthèse par Niveau (Master & MBA)
    const nivGrid = $("niveauSummaryGrid");
    nivGrid.innerHTML = ["Master", "MBA"]
      .map((niv) => {
        const d = stats.par_niveau?.[niv] || { total: 0, a_programmer: 0, programmee: 0, realisee: 0 };
        const pct = d.total ? Math.round(((d.programmee + d.realisee) / d.total) * 100) : 0;
        return `
          <div class="niveau-card">
            <div class="niveau-card-head">
              <strong>${niv}</strong>
              <span class="muted-small">${d.total} module(s) · ${pct}% traité</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="niveau-mini-stats">
              <span>À prog. : <strong>${d.a_programmer}</strong></span>
              <span>Ouvertes : <strong>${d.programmee}</strong></span>
              <span>Réalisées : <strong>${d.realisee}</strong></span>
            </div>
          </div>
        `;
      })
      .join("");

    // Populate filterProgramme options
    const progFilter = $("filterProgramme");
    const prevProg = progFilter.value;
    const usedProgs = Array.from(
      new Set(state.declarations.map((d) => d.programme).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "fr"));
    progFilter.innerHTML =
      `<option value="">Tous les programmes</option>` +
      usedProgs.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
    if (usedProgs.includes(prevProg)) progFilter.value = prevProg;

    renderDeclarationsTable();
  }

  function renderDeclarationsTable() {
    const fStatut = $("filterStatut").value;
    const fNiveau = $("filterNiveau").value;
    const fProg = $("filterProgramme").value;
    const fQuery = normalizeText($("filterSearch").value);

    const rows = state.declarations
      .filter((d) => {
        if (fStatut && d.statut !== fStatut) return false;
        if (fNiveau && d.niveau !== fNiveau) return false;
        if (fProg && d.programme !== fProg) return false;
        if (fQuery) {
          const blob = normalizeText(
            `${d.id} ${d.classe} ${d.programme} ${d.code_ecue} ${d.module} ${d.intervenant} ${d.email_intervenant} ${d.cmid}`
          );
          if (!blob.includes(fQuery)) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        const order = { A_programmer: 0, Programmee: 1, Realisee: 2, Annulee: 3 };
        const diff = (order[a.statut] ?? 9) - (order[b.statut] ?? 9);
        if (diff !== 0) return diff;
        return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
      });

    const tbody = $("declarationsTableBody");
    const emptyState = $("tableEmptyState");

    if (!rows.length) {
      tbody.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    tbody.innerHTML = rows
      .map((d) => {
        const statutLabel = STATUT_LABELS[d.statut] || d.statut;
        const moodleCell = d.lien_moodle
          ? `<a class="moodle-link" href="${escapeHtml(d.lien_moodle)}" target="_blank" rel="noopener">CMID ${escapeHtml(d.cmid || "Ouvrir")} ↗</a>`
          : d.moodle_course_id
          ? `<a class="moodle-link" href="${MOODLE_BASE_URL}/course/view.php?id=${escapeHtml(d.moodle_course_id)}&section=1" target="_blank" rel="noopener">Cours #${escapeHtml(d.moodle_course_id)} ↗</a>`
          : `<span class="muted-small">—</span>`;

        const quickNextBtn =
          d.statut === "A_programmer"
            ? `<button class="btn btn-xs btn-soft" type="button" data-quick-statut="Programmee" data-id="${escapeHtml(d.id)}">Ouverte</button>`
            : d.statut === "Programmee"
            ? `<button class="btn btn-xs btn-soft" type="button" data-quick-statut="Realisee" data-id="${escapeHtml(d.id)}">Réalisée</button>`
            : "";

        return `
          <tr>
            <td>
              <span class="status-badge status-${escapeHtml(d.statut)}">${escapeHtml(statutLabel)}</span>
              <div class="cell-sub">${escapeHtml(d.id)}</div>
            </td>
            <td>
              <div class="cell-main">${escapeHtml(d.classe)}</div>
              <div class="cell-sub">${escapeHtml(d.niveau || "")} ${d.programme ? "· " + escapeHtml(d.programme) : ""}</div>
            </td>
            <td>
              <div class="cell-main">${escapeHtml(d.module)}</div>
              <div class="cell-sub">${d.code_ecue ? escapeHtml(d.code_ecue) + " · " : ""}${escapeHtml(d.semestre || "")}</div>
            </td>
            <td>
              <div class="cell-main">${escapeHtml(d.intervenant)}</div>
              <div class="cell-sub">${escapeHtml(d.email_intervenant || "—")}</div>
            </td>
            <td>${escapeHtml(d.date_fin_module || d.date_ouverture || "—")}</td>
            <td>
              ${moodleCell}
              ${d.date_ouverture ? `<div class="cell-sub">Ouv. ${escapeHtml(d.date_ouverture)}</div>` : ""}
            </td>
            <td>${d.nb_repondants !== null && d.nb_repondants !== undefined && d.nb_repondants !== "" ? escapeHtml(d.nb_repondants) : "—"}</td>
            <td>
              <div class="row-actions">
                ${quickNextBtn}
                <button class="btn btn-xs btn-outline" type="button" data-edit-id="${escapeHtml(d.id)}">Éditer</button>
                <button class="btn btn-xs btn-danger-soft" type="button" data-delete-id="${escapeHtml(d.id)}">Suppr.</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll("[data-quick-statut]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const nextStatut = btn.dataset.quickStatut;
        const patch = { statut: nextStatut };
        if (nextStatut === "Programmee") patch.date_ouverture = todayIso();
        if (nextStatut === "Realisee") patch.date_cloture = todayIso();
        try {
          await apiUpdateDeclaration(id, patch);
          showToast(`Statut mis à jour : ${STATUT_LABELS[nextStatut]}`);
          renderAll();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });

    tbody.querySelectorAll("[data-edit-id]").forEach((btn) => {
      btn.addEventListener("click", () => openEditModal(btn.dataset.editId));
    });

    tbody.querySelectorAll("[data-delete-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.deleteId;
        if (!confirm(`Supprimer l'entrée ${id} ?`)) return;
        try {
          await apiDeleteDeclaration(id);
          showToast("Entrée supprimée.");
          renderAll();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });
  }

  function openEditModal(id) {
    const item = state.declarations.find((x) => x.id === id);
    if (!item) return;
    $("editId").value = item.id;
    $("editStatut").value = item.statut || "A_programmer";
    $("editClasse").value = item.classe || "";
    $("editModule").value = item.module || "";
    $("editIntervenant").value = item.intervenant || "";
    $("editEmail").value = item.email_intervenant || "";
    $("editCmid").value = item.cmid || "";
    $("editDateOuverture").value = item.date_ouverture || "";
    $("editDateCloture").value = item.date_cloture || "";
    $("editLienMoodle").value = item.lien_moodle || "";
    $("editNbRepondants").value = item.nb_repondants ?? "";
    $("editObservations").value = item.observations || "";
    $("editModal").classList.remove("hidden");
  }

  /* ------------------------------------------------------------------ */
  /* Import Excel / CSV Colleague Table (4 columns)                     */
  /* ------------------------------------------------------------------ */
  function parseDelimitedText(rawText) {
    const lines = rawText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];

    const first = lines[0];
    const delim = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";

    const splitLine = (line) => {
      const cols = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === delim && !inQuotes) {
          cols.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      cols.push(cur.trim());
      return cols;
    };

    const parsedRows = lines.map(splitLine);
    const headerNorm = parsedRows[0].map(normalizeText);
    const hasHeader =
      headerNorm.some((h) => h.includes("module")) &&
      headerNorm.some((h) => h.includes("intervenant") || h.includes("classe"));

    let idxMod = 0;
    let idxInt = 1;
    let idxCls = 2;
    let idxMail = 3;
    let startRow = 0;

    if (hasHeader) {
      startRow = 1;
      idxMod = headerNorm.findIndex((h) => h.includes("module") || h.includes("ecue") || h.includes("cours"));
      idxInt = headerNorm.findIndex((h) => h.includes("intervenant") || h.includes("enseignant") || h.includes("prof"));
      idxCls = headerNorm.findIndex((h) => h.includes("classe") || h.includes("filiere") || h.includes("cohorte"));
      idxMail = headerNorm.findIndex((h) => h.includes("mail") || h.includes("courriel"));
    }

    const rows = [];
    for (let i = startRow; i < parsedRows.length; i++) {
      const cols = parsedRows[i];
      const mod = (cols[idxMod] || "").trim();
      const prof = (cols[idxInt] || "").trim();
      const cls = (cols[idxCls] || "").trim();
      const mail = idxMail >= 0 ? (cols[idxMail] || "").trim() : "";
      if (!mod && !prof && !cls) continue;
      rows.push({
        Modules: mod,
        Intervenants: prof,
        Classe: cls,
        "Adresse email": mail,
      });
    }
    return rows;
  }

  function updateImportPreview(rawText) {
    const rows = parseDelimitedText(rawText);
    state.parsedImportRows = rows;
    const preview = $("importPreviewArea");
    const btn = $("btnConfirmImport");
    if (!rows.length) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
      btn.disabled = true;
      btn.textContent = "Importer dans « À programmer »";
      return;
    }

    preview.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = `Importer ${rows.length} ligne(s) dans « À programmer »`;
    preview.innerHTML = `
      <table class="data-table">
        <thead>
          <tr><th>Modules</th><th>Intervenants</th><th>Classe</th><th>Adresse email</th></tr>
        </thead>
        <tbody>
          ${rows
            .slice(0, 15)
            .map(
              (r) => `<tr>
                <td>${escapeHtml(r.Modules)}</td>
                <td>${escapeHtml(r.Intervenants)}</td>
                <td>${escapeHtml(r.Classe)}</td>
                <td>${escapeHtml(r["Adresse email"])}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
      ${rows.length > 15 ? `<div class="muted-small" style="padding:8px 12px;">… et ${rows.length - 15} autre(s) ligne(s).</div>` : ""}
    `;
  }

  async function confirmImportRows() {
    if (!state.parsedImportRows.length) return;
    const declarant_nom = $("importDeclarantNom").value.trim() || "Import Fichier Collègue";
    try {
      if (state.mode === "local") {
        const res = await fetch("/api/import-rows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: state.parsedImportRows, declarant_nom }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur d'import");
        await loadFromServer();
        showToast(`Import terminé : ${data.added} ajouté(s), ${data.skipped_duplicates} doublon(s) ignoré(s).`);
      } else if (state.mode === "cloud") {
        const res = await fetch(state.gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "importRows", rows: state.parsedImportRows, declarant_nom }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        await loadFromServer();
        showToast(`Import Cloud terminé : ${data.added} ajouté(s), ${data.skipped_duplicates || 0} doublon(s) ignoré(s).`);
      } else {
        const mapped = state.parsedImportRows
          .filter((r) => r.Modules && r.Intervenants && r.Classe)
          .map((r) => ({
            classe: r.Classe,
            module: r.Modules,
            intervenant: r.Intervenants,
            email_intervenant: r["Adresse email"] || "",
            declarant_nom,
            source: "import_collegue",
          }));
        const res = await apiCreateDeclarations(mapped, false);
        showToast(`${res.added || mapped.length} module(s) importé(s) !`);
      }
      $("importModal").classList.add("hidden");
      $("importPasteTextarea").value = "";
      $("importFileInput").value = "";
      state.parsedImportRows = [];
      renderAll();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Tab 3: Automation Queue, AI Prompt & Cloud Sync                    */
  /* ------------------------------------------------------------------ */
  function renderAutomationTab() {
    const pending = state.declarations.filter((d) => d.statut === "A_programmer");
    $("queueCountLabel").textContent = String(pending.length);
    $("btnCopyAiPrompt").disabled = pending.length === 0;
    $("btnDownloadPendingBatch").disabled = pending.length === 0;

    const queueList = $("pendingQueueList");
    if (!pending.length) {
      queueList.innerHTML = `
        <div class="empty-table">
          Aucune évaluation en attente. Dès qu’un responsable déclare la fin d’un module dans l’onglet 1, il apparaît ici.
        </div>
      `;
    } else {
      queueList.innerHTML = pending
        .map(
          (item) => `
          <div class="queue-item">
            <div class="label-between">
              <strong>${escapeHtml(item.classe)} — ${escapeHtml(item.module)}</strong>
              <span class="ecue-code">${escapeHtml(item.code_ecue || item.id)}</span>
            </div>
            <div class="cell-sub">
              Intervenant : <strong>${escapeHtml(item.intervenant)}</strong> (${escapeHtml(item.email_intervenant || "email non renseigné")})
              ${item.moodle_course_id ? ` · Cours Moodle #${escapeHtml(item.moodle_course_id)}` : ""}
              ${item.date_fin_module ? ` · Fin : ${escapeHtml(item.date_fin_module)}` : ""}
            </div>
          </div>
        `
        )
        .join("");
    }

    const previewTarget = pending[0] || state.declarations[0] || {
      module: "Droit de la concurrence",
      intervenant: "M. Jean Baptiste DIOUF",
      classe: "MACG1 Jour A",
    };
    $("cartonVertPreview").innerHTML = buildCartonVertHtml(
      previewTarget.module,
      previewTarget.intervenant,
      previewTarget.classe
    );

    $("gasUrlInput").value = state.gasUrl;
    if (CONFIG.SPREADSHEET_URL) {
      $("masterSheetBox").classList.remove("hidden");
      $("masterSheetLink").href = CONFIG.SPREADSHEET_URL;
    } else {
      $("masterSheetBox").classList.add("hidden");
    }
    $("gasStatusText").textContent = state.gasUrl
      ? "Connecté au Google Sheet configuré. Tous les collègues partagent la même file."
      : "Aucune URL Cloud configurée : le portail fonctionne avec le serveur local / stockage navigateur.";
  }

  function downloadJsonFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadPendingBatch() {
    if (state.mode === "local") {
      window.location.href = "/api/export/pending";
      return;
    }
    const pending = state.declarations
      .filter((d) => d.statut === "A_programmer")
      .map((item) => ({
        ...item,
        moodle_category_id: 372,
        carton_vert_html: buildCartonVertHtml(item.module, item.intervenant, item.classe),
      }));
    downloadJsonFile(`lot_a_programmer_${todayIso()}.json`, {
      generated_at: new Date().toISOString(),
      moodle_base_url: MOODLE_BASE_URL,
      moodle_category_id: 372,
      count: pending.length,
      items: pending,
    });
  }

  async function copyAiPrompt() {
    const pending = state.declarations.filter((d) => d.statut === "A_programmer");
    if (!pending.length) return;
    const lines = pending.map((item, idx) => {
      const courseNote = item.moodle_course_id ? ` [Cours Moodle id=${item.moodle_course_id}]` : "";
      const codeNote = item.code_ecue ? ` (${item.code_ecue})` : "";
      return `${idx + 1}. [${item.id}] Classe : ${item.classe}${courseNote} | Module : ${item.module}${codeNote} | Intervenant : ${item.intervenant} | Email : ${item.email_intervenant || "N/A"}`;
    });
    const prompt = [
      "Programme les évaluations des enseignements suivantes sur Moodle CESAG ONLINE (https://formations.cesagonline.com), Catégorie 372 (ÉVALUATION DES ENSEIGNEMENTS 26-27) :",
      "",
      ...lines,
      "",
      "Protocole CESAG à appliquer pour chaque module :",
      "1. Ouvrir le cours cible en catégorie 372 (/course/view.php?id={course_id}&section=1) et localiser le Feedback masqué correspondant à l'intitulé ECUE (ou le premier emplacement masqué 'MODULE X' si le cours n'est pas encore renommé).",
      "2. Dans /course/modedit.php?update={cmid}&return=0 : mettre #id_name = intitulé du module, injecter la carte HTML officielle CESAG (#0B5D3B, bordure or #B7862A, encart 'Confidentialité des réponses', nom du module et de l'enseignant) dans #id_introeditoreditable et #id_intro.",
      "3. Passer #id_visible = '1' (Afficher aux étudiants) et valider avec #id_submitbutton2, tout en gardant les autres modules non demandés strictement masqués (visible = 0).",
      "4. Générer resultats_moodle.json avec {id, cmid, lien_moodle, moodle_course_id, statut: \"Programmee\", date_ouverture} pour réimport dans la mini-plateforme.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(prompt);
      showToast(`Prompt IA copié (${pending.length} module(s) inclus) !`);
    } catch (_err) {
      showToast("Copie automatique bloquée par le navigateur ; utilisez le bouton Télécharger JSON.", "warn");
    }
  }

  async function handleMoodleResultsUpload(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const results = Array.isArray(parsed) ? parsed : parsed.results || parsed.items || [];
      if (!results.length) {
        showToast("Aucune entrée trouvée dans ce fichier JSON.", "warn");
        return;
      }

      if (state.mode === "local") {
        const res = await fetch("/api/import-moodle-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results }),
        });
        const data = await res.json();
        await loadFromServer();
        showToast(`${data.updated} évaluation(s) mise(s) à jour depuis Moodle !`);
      } else if (state.mode === "cloud") {
        const res = await fetch(state.gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "importResults", results }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        await loadFromServer();
        showToast(`${data.updated} évaluation(s) mise(s) à jour dans Google Sheets !`);
      } else {
        let updated = 0;
        for (const r of results) {
          if (r.id) {
            await apiUpdateDeclaration(r.id, {
              cmid: r.cmid || "",
              lien_moodle: r.lien_moodle || "",
              statut: r.statut || "Programmee",
              date_ouverture: r.date_ouverture || todayIso(),
              nb_repondants: r.nb_repondants ?? null,
            });
            updated++;
          }
        }
        showToast(`${updated} évaluation(s) mise(s) à jour !`);
      }
      renderAll();
    } catch (err) {
      showToast(`Erreur lecture JSON : ${err.message}`, "error");
    }
  }

  function renderAll() {
    renderDatalists();
    renderEcueChecklist();
    renderSelectedModules();
    renderDashboard();
    renderAutomationTab();
  }

  function bindEvents() {
    // Tab switching with password protection for restricted tabs
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;
        if ((targetTab === "dashboard" || targetTab === "automation") && sessionStorage.getItem("CESAG_PLANNING_AUTH") !== "true") {
          openAuthModal(targetTab);
          return;
        }
        document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        $(`tab-${targetTab}`).classList.add("active");
      });
    });

    $("programmeSearch").addEventListener("input", () => renderProgramSelect(true));
    $("programmeSelect").addEventListener("change", (e) => {
      state.activeProgrammeId = e.target.value;
      state.activeSemestre = "ALL";
      renderClasseSuggestions(true);
      renderSemestrePills();
      renderEcueChecklist();
    });

    $("classeInput").addEventListener("input", () => {
      renderClasseSuggestions(false);
      renderEcueChecklist();
      renderSelectedModules();
    });

    $("moduleSearchInput").addEventListener("input", () => renderEcueChecklist());

    $("btnSelectVisibleEcues").addEventListener("click", () => {
      const prog = getSelectedProgram();
      if (!prog) return;
      getFilteredEcues().forEach((e) => addSelectedEcue(prog, e));
      renderEcueChecklist();
      renderSelectedModules();
    });

    $("btnClearSelectedEcues").addEventListener("click", () => {
      state.selectedEcues.clear();
      renderEcueChecklist();
      renderSelectedModules();
    });

    $("btnApplyDefaultDate").addEventListener("click", () => {
      const dateOuv = $("defaultDateOuverture")?.value || todayIso();
      const dateClot = $("defaultDateCloture")?.value || "";
      state.selectedEcues.forEach((item) => {
        item.date_ouverture = dateOuv;
        item.date_cloture = dateClot;
        item.date_fin_module = dateOuv;
      });
      renderSelectedModules();
      showToast(`Dates appliquées : ouverture le ${dateOuv}${dateClot ? ", clôture le " + dateClot : ""}`);
    });

    $("btnSubmitDeclarations").addEventListener("click", handleSubmitDeclarations);

    // Dashboard Filters & Exports
    ["filterStatut", "filterNiveau", "filterProgramme"].forEach((id) => {
      $(id).addEventListener("change", renderDeclarationsTable);
    });
    $("filterSearch").addEventListener("input", renderDeclarationsTable);
    $("btnResetFilters").addEventListener("click", () => {
      $("filterStatut").value = "";
      $("filterNiveau").value = "";
      $("filterProgramme").value = "";
      $("filterSearch").value = "";
      renderDeclarationsTable();
    });

    $("btnExportExcel").addEventListener("click", () => {
      if (state.mode === "local") {
        window.location.href = "/api/export/excel";
      } else {
        // Clean UTF-8 BOM CSV export fallback in browser-only / cloud mode
        const header = ["ID", "Statut", "Niveau", "Programme", "Classe", "Code ECUE", "Module", "Intervenant", "Email", "Date Fin", "CMID", "Lien Moodle", "Repondants"];
        const lines = [header.join(";")].concat(
          state.declarations.map((d) =>
            [
              d.id, d.statut, d.niveau, d.programme, d.classe, d.code_ecue, d.module,
              d.intervenant, d.email_intervenant, d.date_fin_module, d.cmid, d.lien_moodle, d.nb_repondants ?? "",
            ]
              .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
              .join(";")
          )
        );
        const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `CESAG_Evaluations_${todayIso()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    });

    $("btnExportPendingJson").addEventListener("click", downloadPendingBatch);
    $("btnDownloadPendingBatch").addEventListener("click", downloadPendingBatch);
    $("btnCopyAiPrompt").addEventListener("click", copyAiPrompt);

    $("inputMoodleResultsFile").addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      handleMoodleResultsUpload(f);
      e.target.value = "";
    });

    // Modals
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $(btn.dataset.closeModal).classList.add("hidden");
      });
    });

    function downloadOfficialTemplateCsv() {
      const headers = ["Filière", "Cohorte_Officielle_Moodle", "Code_ECUE", "Intitulé_Module", "Nom_Intervenant", "Email_Intervenant_Facultatif", "Date_Fin_Module", "Observations"];
      const sampleRows = [
        ["MACG", "Master en Audit et Contrôle de Gestion - JOUR", "MACG 7.1.4", "Droit de la concurrence", "M. Jean Baptiste DIOUF", "intervenant@cesag.edu.sn", "2026-11-20", "Exemple cours acheve"],
        ["LG", "Licence en Gestion - L1", "LG 1.1.2", "Comptabilité générale", "Mme Aminata SOW", "", "2026-11-22", "Email facultatif"],
        ["MBA GP", "MBA en Gestion des Projets", "MBAGP 8.2.1", "Gestion de projets agile", "Dr. Mamadou BA", "", "2026-11-25", "Exemple"],
      ];
      const csvContent = "\uFEFF" + [headers.join(";"), ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";"))].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modele_declaration_evaluations_cesag.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Modèle CSV officiel téléchargé !");
    }

    function downloadOfficialTemplateXlsx() {
      if (window.XLSX) {
        const data = [
          ["Filière", "Cohorte_Officielle_Moodle", "Code_ECUE", "Intitulé_Module", "Nom_Intervenant", "Email_Intervenant_Facultatif", "Date_Fin_Module", "Observations"],
          ["MACG", "Master en Audit et Contrôle de Gestion - JOUR", "MACG 7.1.4", "Droit de la concurrence", "M. Jean Baptiste DIOUF", "intervenant@cesag.edu.sn", "2026-11-20", "Exemple cours achevé"],
          ["LG", "Licence en Gestion - L1", "LG 1.1.2", "Comptabilité générale", "Mme Aminata SOW", "", "2026-11-22", "Email facultatif"],
          ["MBA GP", "MBA en Gestion des Projets", "MBAGP 8.2.1", "Gestion de projets agile", "Dr. Mamadou BA", "", "2026-11-25", "Exemple"],
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Déclarations");
        XLSX.writeFile(wb, "modele_declaration_evaluations_cesag.xlsx");
        showToast("Modèle Excel officiel (.xlsx) téléchargé !");
      } else {
        downloadOfficialTemplateCsv();
      }
    }

    // Landing Page Actions
    const goDeclareTab = () => {
      const tabDeclare = document.querySelector('.nav-tab[data-tab="declare"]');
      if (tabDeclare) tabDeclare.click();
    };
    if ($("btnLandingGoDeclare")) $("btnLandingGoDeclare").addEventListener("click", goDeclareTab);
    if ($("btnLandingBrowseCatalog")) $("btnLandingBrowseCatalog").addEventListener("click", goDeclareTab);

    // Filter Direction (DPGELM vs DPECN)
    const dirFilterEl = $("directionFilterSelect");
    const syncDirBlocks = () => {
      document.querySelectorAll("[data-dir-block]").forEach((b) => {
        const on = dirFilterEl && dirFilterEl.value === b.dataset.dirBlock;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    };
    document.querySelectorAll("[data-dir-block]").forEach((b) => {
      b.addEventListener("click", () => {
        if (!dirFilterEl) return;
        dirFilterEl.value = dirFilterEl.value === b.dataset.dirBlock ? "ALL" : b.dataset.dirBlock;
        dirFilterEl.dispatchEvent(new Event("change"));
      });
    });
    if (dirFilterEl) dirFilterEl.addEventListener("change", syncDirBlocks);
    syncDirBlocks();
    if (dirFilterEl) {
      dirFilterEl.addEventListener("change", () => {
        state.activeDirection = dirFilterEl.value;
        if (state.activeDirection === "DPGELM") {
          state.activeNiveau = "Licence";
        } else if (state.activeDirection === "DPECN") {
          state.activeNiveau = "MBA";
        }
        state.activeProgrammeId = "";
        state.activeSemestre = "ALL";
        renderNiveauPills();
        renderProgramSelect(true);
        renderClasseSuggestions(true);
        renderSemestrePills();
        renderEcueChecklist();
      });
    }

    document.querySelectorAll(".btn-quick-direction").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = btn.dataset.direction;
        goDeclareTab();
        if (dirFilterEl) {
          dirFilterEl.value = dir;
          dirFilterEl.dispatchEvent(new Event("change"));
        }
      });
    });

    document.querySelectorAll(".btn-quick-niveau").forEach((btn) => {
      btn.addEventListener("click", () => {
        const niv = btn.dataset.quickNiveau;
        goDeclareTab();
        if (niv) {
          state.activeNiveau = niv;
          state.activeProgrammeId = "";
          renderNiveauPills();
          renderProgramSelect(true);
          renderClasseSuggestions(true);
          renderSemestrePills();
          renderEcueChecklist();
          renderSelectedModules();
        }
      });
    });
    if ($("btnLandingDownloadCsv")) $("btnLandingDownloadCsv").addEventListener("click", downloadOfficialTemplateCsv);
    if ($("btnModalDownloadCsv")) $("btnModalDownloadCsv").addEventListener("click", downloadOfficialTemplateCsv);
    if ($("btnLandingDownloadXlsx")) $("btnLandingDownloadXlsx").addEventListener("click", downloadOfficialTemplateXlsx);
    if ($("btnModalDownloadXlsx")) $("btnModalDownloadXlsx").addEventListener("click", downloadOfficialTemplateXlsx);

    const openImport = () => $("importModal").classList.remove("hidden");
    $("btnOpenImportModal").addEventListener("click", openImport);
    $("btnOpenQuickImportFromDeclare").addEventListener("click", openImport);
    if ($("btnLandingOpenImport")) $("btnLandingOpenImport").addEventListener("click", openImport);

    $("importPasteTextarea").addEventListener("input", (e) => updateImportPreview(e.target.value));
    $("importFileInput").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        if (window.XLSX) {
          try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: "array" });
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            const csv = XLSX.utils.sheet_to_csv(firstSheet);
            $("importPasteTextarea").value = csv;
            updateImportPreview(csv);
            showToast(`Fichier Excel importé : ${wb.SheetNames[0]} (${file.name})`);
            return;
          } catch (err) {
            showToast(`Erreur lecture Excel : ${err.message}`, "error");
          }
        }
      }
      const text = await file.text();
      $("importPasteTextarea").value = text;
      updateImportPreview(text);
    });
    $("btnConfirmImport").addEventListener("click", confirmImportRows);

    $("editForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("editId").value;
      const patch = {
        statut: $("editStatut").value,
        classe: $("editClasse").value.trim(),
        module: $("editModule").value.trim(),
        intervenant: $("editIntervenant").value.trim(),
        email_intervenant: $("editEmail").value.trim(),
        cmid: $("editCmid").value.trim(),
        date_ouverture: $("editDateOuverture").value,
        date_cloture: $("editDateCloture").value,
        lien_moodle: $("editLienMoodle").value.trim(),
        nb_repondants: $("editNbRepondants").value === "" ? null : Number($("editNbRepondants").value),
        observations: $("editObservations").value.trim(),
      };
      try {
        await apiUpdateDeclaration(id, patch);
        $("editModal").classList.add("hidden");
        showToast("Évaluation mise à jour.");
        renderAll();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    // Cloud GAS config
    $("btnSaveGasUrl").addEventListener("click", async () => {
      const url = $("gasUrlInput").value.trim();
      if (!url) {
        showToast("Collez l'URL Web App Google Apps Script.", "warn");
        return;
      }
      state.gasUrl = url;
      localStorage.setItem(STORAGE_KEY_GAS, url);
      await detectBackend();
      renderAll();
      if (state.mode === "cloud") {
        showToast("Connexion Cloud Google Sheets activée !");
      }
    });

    $("btnSyncNow").addEventListener("click", async () => {
      await loadFromServer();
      renderAll();
      showToast("Synchronisation terminée.");
    });

    $("btnClearGasUrl").addEventListener("click", async () => {
      state.gasUrl = "";
      localStorage.removeItem(STORAGE_KEY_GAS);
      await detectBackend();
      renderAll();
      showToast("Retour en mode local.");
    });
  }

  function initDakarWeather() {
    const text = $("weatherText");
    const icon = $("weatherIcon");
    if (!text) return;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=14.6928&longitude=-17.4467&current_weather=true")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          let ic = "☀️";
          if (code >= 1 && code <= 3) ic = "🌤️";
          else if (code >= 45 && code <= 48) ic = "🌫️";
          else if (code >= 51 && code <= 67) ic = "🌧️";
          else if (code >= 80) ic = "🌦️";
          if (icon) icon.textContent = ic;
          text.setAttribute("data-temp", String(temp));
          const isCockpit = document.body.classList.contains("mode-cockpit");
          text.textContent = isCockpit ? `GOBD / DSS · ${temp}°C · CAVOK` : `Dakar ${temp}°C`;
        }
      })
      .catch(() => {
        text.setAttribute("data-temp", "28");
        const isCockpit = document.body.classList.contains("mode-cockpit");
        text.textContent = isCockpit ? "GOBD / DSS · 28°C · CAVOK" : "Dakar 28°C";
      });
  }

  function playCabinChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.16, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(440.0, now + 0.20);
      gain2.gain.setValueAtTime(0.14, now + 0.20);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.20);
      osc2.stop(now + 0.75);
    } catch (_e) {}
  }

  function triggerFlightTakeoff() {
    playCabinChime();
    const plane = $("flightTakeoffAnim");
    if (plane) {
      plane.classList.remove("flying");
      void plane.offsetWidth;
      plane.classList.add("flying");
      setTimeout(() => plane.classList.remove("flying"), 2500);
    }
  }

  function updateWeatherAviation(cockpitActive) {
    const text = $("weatherText");
    if (!text) return;
    const rawTemp = text.getAttribute("data-temp") || "28";
    if (cockpitActive) {
      text.textContent = `GOBD / DSS · ${rawTemp}°C · CAVOK`;
    } else {
      text.textContent = `Dakar ${rawTemp}°C`;
    }
  }

  function initCockpitMode() {
    const btn = $("btnToggleCockpit");
    if (!btn) return;
    const isCockpit = localStorage.getItem("CESAG_COCKPIT_MODE") === "true";
    if (isCockpit) {
      document.body.classList.add("mode-cockpit");
      btn.classList.add("active");
      const label = btn.querySelector("span:last-child");
      if (label) label.textContent = "✈️ Cockpit ON";
    }

    btn.addEventListener("click", () => {
      const active = document.body.classList.toggle("mode-cockpit");
      btn.classList.toggle("active", active);
      const label = btn.querySelector("span:last-child");
      if (label) label.textContent = active ? "✈️ Cockpit ON" : "✈️ Cockpit";
      localStorage.setItem("CESAG_COCKPIT_MODE", active ? "true" : "false");
      triggerFlightTakeoff();
      updateWeatherAviation(active);
      if (active) {
        showToast("🛫 Tour de Contrôle CESAG : Mode Cockpit activé · Contact radio 5/5 avec Oscar Kakpo !");
      } else {
        showToast("Retour au mode standard.");
      }
      renderSelectedModules();
    });
  }


  // Guide Modal (Pop-up collègues)
  function initGuideModal() {
    const modal = $("guideModal");
    const closeBtn = $("btnCloseGuideModal");
    const startBtn = $("btnStartDeclareFromGuide");
    const dontShowChk = $("chkDontShowGuideAgain");
    const openGuideBtn = $("btnOpenGuideModal");

    function openGuide() {
      if (modal) {
        modal.classList.remove("hidden");
        modal.hidden = false;
      }
    }

    function closeGuide() {
      if (modal) {
        modal.classList.add("hidden");
        modal.hidden = true;
      }
      if (dontShowChk && dontShowChk.checked) {
        localStorage.setItem("CESAG_HIDE_GUIDE", "true");
      }
    }

    if (closeBtn) closeBtn.addEventListener("click", closeGuide);
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        closeGuide();
        const tabDeclare = document.querySelector('.nav-tab[data-tab="declare"]');
        if (tabDeclare) tabDeclare.click();
      });
    }
    if (openGuideBtn) openGuideBtn.addEventListener("click", openGuide);
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeGuide();
      });
    }

    // Auto-open on first visit if not disabled
    if (localStorage.getItem("CESAG_HIDE_GUIDE") !== "true") {
      setTimeout(openGuide, 600);
    }
  }

  // Password Protection for Dashboard & Automation Tabs
  let pendingRestrictedTab = null;
  const PLANNING_PASSWORDS = ["cesag2026", "cesag2627", "cesag", "oscar2026", "cesag dakar", "admin"];

  function openAuthModal(targetTab) {
    pendingRestrictedTab = targetTab || "dashboard";
    const modal = $("authModal");
    const input = $("planningPasswordInput");
    const err = $("authErrorMsg");
    if (err) err.style.display = "none";
    if (input) input.value = "";
    if (modal) {
      modal.classList.remove("hidden");
      modal.hidden = false;
    }
    setTimeout(() => { if (input) input.focus(); }, 150);
  }

  function closeAuthModal() {
    const modal = $("authModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.hidden = true;
    }
    pendingRestrictedTab = null;
  }

  function initPlanningAuth() {
    const modal = $("authModal");
    const form = $("authForm");
    const closeBtn = $("btnCloseAuthModal");
    const cancelBtn = $("btnCancelAuth");
    const input = $("planningPasswordInput");
    const err = $("authErrorMsg");

    if (closeBtn) closeBtn.addEventListener("click", closeAuthModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeAuthModal);
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeAuthModal();
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const val = (input.value || "").trim().toLowerCase();
        if (PLANNING_PASSWORDS.includes(val)) {
          sessionStorage.setItem("CESAG_PLANNING_AUTH", "true");
          closeAuthModal();
          showToast("🔓 Accès coordination déverrouillé. Bienvenue M. Kakpo !");
          const target = pendingRestrictedTab || "dashboard";
          const tabBtn = document.querySelector(`.nav-tab[data-tab="${target}"]`);
          if (tabBtn) {
            document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
            tabBtn.classList.add("active");
            $(`tab-${target}`).classList.add("active");
          }
        } else {
          if (err) err.style.display = "block";
          if (input) {
            input.focus();
            input.select();
          }
        }
      });
    }
  }

  async function init() {
    if ($("defaultDateOuverture")) $("defaultDateOuverture").value = todayIso();
    if ($("defaultDateCloture")) {
      const d7 = new Date();
      d7.setDate(d7.getDate() + 7);
      $("defaultDateCloture").value = d7.toISOString().slice(0, 10);
    }
    try {
      const savedProfile = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILE) || "{}");
      if (savedProfile.declarant_nom) $("declarantNom").value = savedProfile.declarant_nom;
      if (savedProfile.declarant_email) $("declarantEmail").value = savedProfile.declarant_email;
    } catch (_err) {
      // Ignore malformed profile
    }

    initDakarWeather();
    initCockpitMode();
    initGuideModal();
    initPlanningAuth();
    await detectBackend();
    renderNiveauPills();
    renderProgramSelect(true);
    bindEvents();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
