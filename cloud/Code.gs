/**
 * CESAG ONLINE — Bridge Google Apps Script pour la Mini-Plateforme Évaluations 26-27
 *
 * Déploiement :
 * 1. Ouvrir votre Google Sheet maître ("CESAG — Suivi Évaluations des Enseignements 26-27").
 * 2. Extensions > Apps Script, coller ce code dans Code.gs.
 * 3. (Optionnel) Paramètres du projet > Propriétés du script : ajouter ACCESS_CODE si vous souhaitez protéger les écritures.
 * 4. (OBLIGATOIRE) Propriétés du script : ajouter ADMIN_PASSWORD = mot de passe de la coordination.
 *    Il protège le tableau de bord, les e-mails et les actions modifier / supprimer / importer.
 * 5. Déployer > Nouveau déploiement > Application Web :
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 5. Copier l'URL /exec dans public/js/config.js (ou dans l'onglet "Automatisation Moodle & Cloud").
 */

const SHEET_DECL = "Declarations";
const SHEET_KPI = "Synthese_KPI";
const DEFAULT_NOTIFY_EMAILS = "oscar.kakpo@cesag.edu.sn, oscarkakpo@gmail.com";
const HEADERS = [
  "id", "statut", "niveau", "programme", "semestre", "classe",
  "code_ecue", "module", "intervenant", "email_intervenant",
  "date_fin_module", "declarant_nom", "declarant_email",
  "cmid", "moodle_course_id", "lien_moodle", "date_ouverture",
  "date_cloture", "nb_repondants", "observations", "source",
  "created_at", "updated_at"
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("CESAG Évaluations")
    .addItem("Vérifier / Initialiser les onglets", "initCesagTabs")
    .addItem("Configurer les e-mails de notification (Outlook / Gmail)", "configureNotifyEmails")
    .addItem("Envoyer un e-mail de test", "sendTestNotification")
    .addToUi();
}

function configureNotifyEmails() {
  const ui = SpreadsheetApp.getUi();
  const current = getNotifyRecipients();
  const resp = ui.prompt(
    "Notifications e-mail (Outlook / Gmail)",
    "Entrez une ou plusieurs adresses séparées par une virgule (ex: oscarkakpo@gmail.com, prenom.nom@cesag.edu.sn) :\nActuel : " + current,
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() === ui.Button.OK) {
    const val = resp.getResponseText().trim();
    if (val) {
      PropertiesService.getScriptProperties().setProperty("NOTIFY_EMAILS", val);
      ui.alert("Destinataires enregistrés : " + val);
    }
  }
}

function initCesagTabs() {
  getOrInitSheet();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNotifyRecipients() {
  const custom = PropertiesService.getScriptProperties().getProperty("NOTIFY_EMAILS");
  return (custom || DEFAULT_NOTIFY_EMAILS || "").trim();
}

function sendDeclarationNotification(items, ss) {
  if (!items || !items.length) return { notified: false, notify_error: null };
  const recipients = getNotifyRecipients();
  if (!recipients) return { notified: false, notify_error: "Aucun destinataire configuré" };

  try {
    const classes = [];
    items.forEach((x) => {
      if (x.classe && classes.indexOf(x.classe) === -1) classes.push(x.classe);
    });
    const uniqueClasses = classes.join(", ") || "CESAG";
    const subject = "🔔 [CESAG Évaluations] " + items.length + " module(s) terminé(s) — " + uniqueClasses;
    const sheetUrl = ss ? ss.getUrl() : "";

    const rowsHtml = items.map((x) => {
      return (
        "<tr>" +
        '<td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;"><strong>' + escapeHtml(x.classe) + "</strong></td>" +
        '<td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;">' + escapeHtml(x.module) + (x.code_ecue ? ' <span style="color:#6B7280;font-size:12px;">(' + escapeHtml(x.code_ecue) + ")</span>" : "") + "</td>" +
        '<td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;">' + escapeHtml(x.intervenant) + (x.email_intervenant ? '<br><span style="color:#6B7280;font-size:12px;">' + escapeHtml(x.email_intervenant) + "</span>" : "") + "</td>" +
        '<td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;">' + escapeHtml(x.date_fin_module || "—") + "</td>" +
        '<td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;">' + escapeHtml(x.declarant_nom || "—") + "</td>" +
        "</tr>"
      );
    }).join("");

    const htmlBody =
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;border:1px solid #D9E8DD;border-radius:12px;overflow:hidden;">' +
      '<div style="background:#0B4D2E;color:#FFFFFF;padding:18px 22px;">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:#F5D58B;text-transform:uppercase;">CESAG · SUIVI-ÉVALUATION 2026-2027</div>' +
      '<h2 style="margin:4px 0 0 0;font-size:19px;">' + items.length + " nouveau(x) module(s) déclaré(s) terminé(s)</h2>" +
      "</div>" +
      '<div style="padding:20px 22px;color:#1F2937;font-size:14px;">' +
      '<p style="margin:0 0 14px 0;">Ces modules ont été enregistrés avec le statut <strong>À programmer</strong> et sont prêts pour ouverture sur Moodle :</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">' +
      '<thead><tr style="background:#F4F8F5;color:#0B4D2E;text-align:left;">' +
      '<th style="padding:8px 10px;border-bottom:2px solid #D9E8DD;">Classe</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #D9E8DD;">Module (ECUE)</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #D9E8DD;">Intervenant</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #D9E8DD;">Fin module</th>' +
      '<th style="padding:8px 10px;border-bottom:2px solid #D9E8DD;">Déclarant</th>' +
      "</tr></thead><tbody>" + rowsHtml + "</tbody></table>" +
      (sheetUrl
        ? '<a href="' + escapeHtml(sheetUrl) + '" style="display:inline-block;background:#0B4D2E;color:#FFFFFF;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px;border-left:4px solid #C9962A;">Ouvrir le Google Sheet de suivi &rarr;</a>'
        : "") +
      "</div></div>";

    MailApp.sendEmail({
      to: recipients,
      subject: subject,
      htmlBody: htmlBody
    });

    // Envoi d'une copie récapitulative au(x) collègue(s) déclarant(s) sans exposer le lien privé du Sheet
    try {
      const recipientList = recipients.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      const byDeclarant = {};
      items.forEach((x) => {
        const em = String(x.declarant_email || "").trim().toLowerCase();
        if (!em || !emailRe.test(em) || recipientList.indexOf(em) !== -1) return;
        if (!byDeclarant[em]) byDeclarant[em] = [];
        byDeclarant[em].push(x);
      });

      Object.keys(byDeclarant).forEach((colleagueEmail) => {
        const cItems = byDeclarant[colleagueEmail];
        const cClasses = [];
        cItems.forEach((x) => {
          if (x.classe && cClasses.indexOf(x.classe) === -1) cClasses.push(x.classe);
        });
        const cRowsHtml = cItems.map((x) => {
          return (
            "<tr>" +
            '<td style="padding:8px 10px;border-bottom:1px solid #DCE7E1;"><strong>' + escapeHtml(x.classe) + "</strong></td>" +
            '<td style="padding:8px 10px;border-bottom:1px solid #DCE7E1;">' + escapeHtml(x.module) + (x.code_ecue ? ' <span style="color:#64748B;font-size:12px;">(' + escapeHtml(x.code_ecue) + ")</span>" : "") + "</td>" +
            '<td style="padding:8px 10px;border-bottom:1px solid #DCE7E1;">' + escapeHtml(x.intervenant || "—") + "</td>" +
            '<td style="padding:8px 10px;border-bottom:1px solid #DCE7E1;">' + escapeHtml(x.date_fin_module || "—") + "</td>" +
            "</tr>"
          );
        }).join("");

        const colleagueBody =
          '<div style="font-family:Arial,Helvetica,sans-serif;max-width:740px;margin:0 auto;background:#FFFFFF;border:1px solid #DCE7E1;border-top:4px solid #0B5D36;border-radius:12px;overflow:hidden;">' +
          '<div style="background:#FFFFFF;color:#084226;padding:18px 22px;border-bottom:1px solid #DCE7E1;">' +
          '<div style="font-size:11px;font-weight:700;letter-spacing:1.1px;color:#B8841E;text-transform:uppercase;">CESAG · ACCUSÉ DE RÉCEPTION ÉVALUATIONS 2026-2027</div>' +
          '<h2 style="margin:6px 0 0 0;font-size:18px;color:#084226;">Confirmation : ' + cItems.length + " module(s) transmis pour programmation Moodle</h2>" +
          "</div>" +
          '<div style="padding:20px 22px;color:#1E293B;font-size:14px;">' +
          '<p style="margin:0 0 14px 0;">Bonjour' + (cItems[0].declarant_nom ? " <strong>" + escapeHtml(cItems[0].declarant_nom) + "</strong>" : "") + ",<br><br>" +
          "Votre déclaration pour <strong>" + escapeHtml(cClasses.join(", ") || "CESAG") + "</strong> a bien été transmise à l'équipe de coordination des évaluations des enseignements.</p>" +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">' +
          '<thead><tr style="background:#F2F9F5;color:#084226;text-align:left;">' +
          '<th style="padding:8px 10px;border-bottom:2px solid #DCE7E1;">Classe</th>' +
          '<th style="padding:8px 10px;border-bottom:2px solid #DCE7E1;">Module (ECUE)</th>' +
          '<th style="padding:8px 10px;border-bottom:2px solid #DCE7E1;">Intervenant</th>' +
          '<th style="padding:8px 10px;border-bottom:2px solid #DCE7E1;">Fin module</th>' +
          "</tr></thead><tbody>" + cRowsHtml + "</tbody></table>" +
          '<p style="margin:0;font-size:12.5px;color:#52606D;">Ceci est une copie automatique de votre déclaration. L\'équipe de planification se charge de l\'ouverture sur Moodle.</p>' +
          "</div></div>";

        MailApp.sendEmail({
          to: colleagueEmail,
          subject: "✅ [CESAG Évaluations] Copie de votre déclaration (" + cItems.length + " module(s)) — " + (cClasses.join(", ") || "CESAG"),
          htmlBody: colleagueBody
        });
      });
    } catch (colleagueErr) {
      Logger.log("Erreur copie collègue : " + colleagueErr);
    }

    return { notified: true, notify_error: null };
  } catch (err) {
    return { notified: false, notify_error: String(err) };
  }
}

function sendTestNotification() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = sendDeclarationNotification([{
    classe: "MACG1 Jour A (Test)",
    code_ecue: "TEST 1.1.1",
    module: "Test de notification CESAG Évaluations",
    intervenant: "Coordination FOAD",
    email_intervenant: "",
    date_fin_module: new Date().toISOString().slice(0, 10),
    declarant_nom: "Test manuel Apps Script"
  }], ss);
  SpreadsheetApp.getUi().alert(
    res.notified
      ? "E-mail de test envoyé à : " + getNotifyRecipients()
      : "Échec d'envoi : " + res.notify_error
  );
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrInitSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_DECL);
  if (!sh) {
    sh = ss.insertSheet(SHEET_DECL);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length)
      .setBackground("#0B4D2E")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
  }
  ensureKpiSheet(ss);
  return sh;
}

function ensureKpiSheet(ss) {
  let kpi = ss.getSheetByName(SHEET_KPI);
  if (!kpi) {
    kpi = ss.insertSheet(SHEET_KPI);
    kpi.getRange("A1:B10").setValues([
      ["SYNTHÈSE SUIVI-ÉVALUATION CESAG 2026-2027", ""],
      ["Indicateur global", "Valeur"],
      ["Total déclarations", "=MAX(0;COUNTA(Declarations!A2:A))"],
      ["Déclarations actives", '=COUNTIF(Declarations!B2:B;"A_programmer")+COUNTIF(Declarations!B2:B;"Programmee")+COUNTIF(Declarations!B2:B;"Realisee")'],
      ["À programmer sur Moodle", '=COUNTIF(Declarations!B2:B;"A_programmer")'],
      ["Programmées / Ouvertes", '=COUNTIF(Declarations!B2:B;"Programmee")'],
      ["Réalisées / Clôturées", '=COUNTIF(Declarations!B2:B;"Realisee")'],
      ["Taux de programmation (%)", "=IFERROR(ROUND((B6+B7)/B4*100;1);0)"],
      ["Taux de réalisation (%)", "=IFERROR(ROUND(B7/B4*100;1);0)"],
      ["Total répondants enregistrés", "=SUM(Declarations!S2:S)"]
    ]);
    kpi.getRange("A2:B2").setBackground("#0B4D2E").setFontColor("#FFFFFF").setFontWeight("bold");
  }
}

function readAllRows(sh) {
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];
  const hdrs = values[0];
  return values.slice(1).map((row) => {
    const obj = {};
    hdrs.forEach((h, i) => {
      obj[h] = row[i] === "" ? "" : row[i];
    });
    if (obj.nb_repondants === "") obj.nb_repondants = null;
    if (obj.moodle_course_id === "") obj.moodle_course_id = null;
    return obj;
  });
}

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nextId(existing) {
  let maxNum = 0;
  existing.forEach((r) => {
    const m = String(r.id || "").match(/EVAL-2627-(\d+)/);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  });
  return "EVAL-2627-" + String(maxNum + 1).padStart(4, "0");
}

function checkAccessCode(body) {
  const requiredCode = PropertiesService.getScriptProperties().getProperty("ACCESS_CODE");
  if (!requiredCode) return true;
  return String(body.access_code || "").trim() === String(requiredCode).trim();
}

/* ---------------------------------------------------------------------------
   Sécurité des données
   - La lecture publique (doGet) ne renvoie AUCUNE adresse e-mail.
   - Les données complètes et les actions de coordination exigent le mot de
     passe ADMIN_PASSWORD (Propriétés du script), vérifié ici côté serveur.
--------------------------------------------------------------------------- */
const PRIVATE_FIELDS = ["email_intervenant", "declarant_email"];

function publicView(rows) {
  return rows.map(function (r) {
    const o = Object.assign({}, r);
    PRIVATE_FIELDS.forEach(function (k) { delete o[k]; });
    return o;
  });
}

function checkAdminPassword(body) {
  const pwd = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!pwd) return false; // non configuré : accès coordination fermé par sécurité
  return String((body && body.admin_password) || "").trim() === String(pwd).trim();
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "list";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = getOrInitSheet();
  if (action === "health") {
    return jsonResponse({
      status: "ok",
      mode: "cloud",
      spreadsheet_id: ss.getId(),
      count: Math.max(0, sh.getLastRow() - 1)
    });
  }
  const declarations = publicView(readAllRows(sh));
  return jsonResponse({
    declarations,
    spreadsheet_id: ss.getId()
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!checkAccessCode(body)) {
      return jsonResponse({ error: "Code d'accès invalide ou requis.", status: 403 });
    }

    const action = body.action || "submit";
    const sh = getOrInitSheet();
    const existing = readAllRows(sh);
    const ts = new Date().toISOString();

    // Actions réservées à la coordination : mot de passe vérifié côté serveur
    const ADMIN_ACTIONS = ["auth", "list_full", "update", "delete", "importRows", "importResults"];
    if (ADMIN_ACTIONS.indexOf(action) !== -1 && !checkAdminPassword(body)) {
      return jsonResponse({ error: "Mot de passe coordination invalide.", status: 401 });
    }
    if (action === "auth" || action === "list_full") {
      return jsonResponse({ ok: true, declarations: existing });
    }

    if (action === "submit") {
      const items = Array.isArray(body.items) ? body.items : [body];
      const force = Boolean(body.force);
      const activeSet = {};
      existing.forEach((x) => {
        if (x.statut !== "Annulee") {
          activeSet[norm(x.classe) + "||" + norm(x.module)] = x;
        }
      });

      const duplicates = [];
      const toAppend = [];
      items.forEach((entry) => {
        const key = norm(entry.classe) + "||" + norm(entry.module);
        if (activeSet[key] && !force) {
          duplicates.push({ classe: entry.classe, module: entry.module });
          return;
        }
        const id = nextId(existing.concat(toAppend));
        const cmid = entry.cmid ? String(entry.cmid) : "";
        const lien = entry.lien_moodle || (cmid ? "https://formations.cesagonline.com/mod/feedback/view.php?id=" + cmid : "");
        const rec = {
          id,
          statut: entry.statut || "A_programmer",
          niveau: entry.niveau || "",
          programme: entry.programme || "",
          semestre: entry.semestre || "",
          classe: entry.classe || "",
          code_ecue: entry.code_ecue || "",
          module: entry.module || "",
          intervenant: entry.intervenant || "",
          email_intervenant: entry.email_intervenant || "",
          date_fin_module: entry.date_fin_module || "",
          declarant_nom: entry.declarant_nom || "",
          declarant_email: entry.declarant_email || "",
          cmid,
          moodle_course_id: entry.moodle_course_id || "",
          lien_moodle: lien,
          date_ouverture: entry.date_ouverture || "",
          date_cloture: entry.date_cloture || "",
          nb_repondants: entry.nb_repondants ?? "",
          observations: entry.observations || "",
          source: entry.source || "mini_plateforme_cloud",
          created_at: ts,
          updated_at: ts
        };
        activeSet[key] = rec;
        toAppend.push(rec);
      });

      if (duplicates.length && !force) {
        return jsonResponse({ error: "duplicate", status: 409, duplicates: publicView(duplicates) });
      }

      toAppend.forEach((rec) => {
        sh.appendRow(HEADERS.map((h) => rec[h] ?? ""));
      });
      const mailResult = sendDeclarationNotification(toAppend, SpreadsheetApp.getActiveSpreadsheet());
      return jsonResponse({
        added: toAppend.length,
        items: toAppend,
        notified: mailResult.notified
      });
    }

    if (action === "importRows") {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const declarantNom = String(body.declarant_nom || "Import Fichier Collègue").trim();
      const activeSet = {};
      existing.forEach((x) => {
        if (x.statut !== "Annulee") {
          activeSet[norm(x.classe) + "||" + norm(x.module)] = x;
        }
      });

      let skipped = 0;
      const toAppend = [];
      rows.forEach((r) => {
        const mod = String(r.Modules || r.Module || r.module || "").trim();
        const prof = String(r.Intervenants || r.Intervenant || r.intervenant || "").trim();
        const cls = String(r.Classe || r.classe || "").trim();
        const email = String(r["Adresse email"] || r.Email || r.email_intervenant || "").trim();
        if (!mod || !prof || !cls) return;
        const key = norm(cls) + "||" + norm(mod);
        if (activeSet[key]) {
          skipped++;
          return;
        }
        const id = nextId(existing.concat(toAppend));
        const rec = {
          id,
          statut: "A_programmer",
          niveau: "",
          programme: "",
          semestre: "",
          classe: cls,
          code_ecue: "",
          module: mod,
          intervenant: prof,
          email_intervenant: email,
          date_fin_module: "",
          declarant_nom: declarantNom,
          declarant_email: "",
          cmid: "",
          moodle_course_id: "",
          lien_moodle: "",
          date_ouverture: "",
          date_cloture: "",
          nb_repondants: "",
          observations: "Import depuis tableau collègue",
          source: "import_collegue_cloud",
          created_at: ts,
          updated_at: ts
        };
        activeSet[key] = rec;
        toAppend.push(rec);
      });

      toAppend.forEach((rec) => {
        sh.appendRow(HEADERS.map((h) => rec[h] ?? ""));
      });
      const mailResult = sendDeclarationNotification(toAppend, SpreadsheetApp.getActiveSpreadsheet());
      return jsonResponse({
        added: toAppend.length,
        skipped_duplicates: skipped,
        items: toAppend,
        notified: mailResult.notified
      });
    }

    if (action === "update") {
      const targetId = body.id;
      const patch = body.patch || {};
      const values = sh.getDataRange().getValues();
      const hdrs = values[0];
      for (let r = 1; r < values.length; r++) {
        if (values[r][0] === targetId) {
          Object.keys(patch).forEach((k) => {
            const col = hdrs.indexOf(k);
            if (col !== -1 && k !== "id") {
              values[r][col] = patch[k] === null ? "" : patch[k];
            }
          });
          const cmidCol = hdrs.indexOf("cmid");
          const lienCol = hdrs.indexOf("lien_moodle");
          if (cmidCol !== -1 && lienCol !== -1 && values[r][cmidCol] && !values[r][lienCol]) {
            values[r][lienCol] = "https://formations.cesagonline.com/mod/feedback/view.php?id=" + values[r][cmidCol];
          }
          const updCol = hdrs.indexOf("updated_at");
          if (updCol !== -1) values[r][updCol] = ts;
          sh.getRange(r + 1, 1, 1, hdrs.length).setValues([values[r]]);
          return jsonResponse({ updated: 1, id: targetId });
        }
      }
      return jsonResponse({ error: "Introuvable: " + targetId });
    }

    if (action === "delete") {
      const targetId = body.id;
      const values = sh.getDataRange().getValues();
      for (let r = values.length - 1; r >= 1; r--) {
        if (values[r][0] === targetId) {
          sh.deleteRow(r + 1);
          return jsonResponse({ deleted: targetId });
        }
      }
      return jsonResponse({ error: "Introuvable: " + targetId });
    }

    if (action === "importResults") {
      const results = Array.isArray(body.results) ? body.results : [];
      const values = sh.getDataRange().getValues();
      const hdrs = values[0];
      let updated = 0;
      results.forEach((res) => {
        for (let r = 1; r < values.length; r++) {
          if (values[r][0] === res.id) {
            ["cmid", "lien_moodle", "statut", "date_ouverture", "date_cloture", "nb_repondants", "moodle_course_id", "observations"].forEach((k) => {
              const col = hdrs.indexOf(k);
              if (col !== -1 && res[k] !== undefined && res[k] !== "") {
                values[r][col] = res[k];
              }
            });
            const updCol = hdrs.indexOf("updated_at");
            if (updCol !== -1) values[r][updCol] = ts;
            sh.getRange(r + 1, 1, 1, hdrs.length).setValues([values[r]]);
            updated++;
          }
        }
      });
      return jsonResponse({ updated });
    }

    return jsonResponse({ error: "Action inconnue: " + action });
  } finally {
    lock.releaseLock();
  }
}
