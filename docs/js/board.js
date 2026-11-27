/* Encadré « Dernières évaluations » sur l'accueil.
   Liste sobre des dernières déclarations, défilement lent (pause au survol).
   Aucune donnée personnelle (ni enseignant, ni e-mail) n'est affichée. */
(function () {
  var STATUS = {
    A_programmer: { label: "À programmer", cls: "status-A_programmer" },
    Programmee:   { label: "Ouverte",      cls: "status-Programmee" },
    Realisee:     { label: "Clôturée",     cls: "status-Realisee" },
    Annulee:      { label: "Annulée",      cls: "status-Annulee" }
  };
  var MAX_ROWS = 12;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function shortDate(v) {
    if (!v) return "";
    var dt = new Date(v);
    if (isNaN(dt)) return "";
    return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Dakar" });
  }

  function build() {
    var host = document.querySelector("#tab-accueil .landing-stats-strip");
    if (!host || document.getElementById("cesagBoard")) return;
    var wrap = document.createElement("section");
    wrap.id = "cesagBoard";
    wrap.className = "evboard";
    wrap.setAttribute("aria-label", "Dernières évaluations");
    wrap.innerHTML =
      '<div class="evboard-head">' +
        '<div><h3>Dernières évaluations</h3><p id="evboardSummary">Suivi en temps réel</p></div>' +
        '<div class="evboard-clock"><span id="evboardClock">--:--</span><small>Dakar</small></div>' +
      '</div>' +
      '<div class="evboard-cols"><span>Module</span><span class="c-classe">Classe</span><span>Niveau</span><span>Date</span><span>Statut</span></div>' +
      '<div class="evboard-viewport"><div class="evboard-rows" id="evboardRows"></div></div>';
    host.parentNode.insertBefore(wrap, host.nextSibling);
  }

  function render() {
    var st = window.CESAG_STATE;
    var rowsEl = document.getElementById("evboardRows");
    if (!st || !rowsEl) return;
    var all = st.declarations || [];
    var list = all.slice().sort(function (a, b) {
      return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
    }).slice(0, MAX_ROWS);

    var sig = list.map(function (d) { return d.id + d.statut; }).join("|");
    if (sig === rowsEl.dataset.sig) return;
    rowsEl.dataset.sig = sig;

    var html;
    if (!list.length) {
      html = '<div class="evboard-empty">Aucune évaluation déclarée pour le moment.</div>';
    } else {
      html = list.map(function (d) {
        var s = STATUS[d.statut] || STATUS.A_programmer;
        return '<div class="evboard-row">' +
          '<span class="e-mod">' + esc(d.module || d.code_ecue || "Module") + '</span>' +
          '<span class="e-cls c-classe">' + esc(d.classe || d.programme || "") + '</span>' +
          '<span class="e-niv">' + esc(d.niveau || "") + '</span>' +
          '<span class="e-date">' + esc(shortDate(d.date_ouverture || d.date_fin_module)) + '</span>' +
          '<span><span class="status-badge ' + s.cls + '">' + s.label + '</span></span>' +
        '</div>';
      }).join("");
      if (list.length > 6) html = html + html; // boucle continue
    }
    rowsEl.innerHTML = html;
    rowsEl.classList.toggle("is-scrolling", list.length > 6);
    rowsEl.style.setProperty("--evboard-duration", Math.max(30, list.length * 5) + "s");

    var c = { A_programmer: 0, Programmee: 0, Realisee: 0 };
    all.forEach(function (d) { if (c[d.statut] != null) c[d.statut]++; });
    document.getElementById("evboardSummary").textContent =
      c.A_programmer + " à programmer · " + c.Programmee + " ouverte" + (c.Programmee > 1 ? "s" : "") + " · " + c.Realisee + " clôturée" + (c.Realisee > 1 ? "s" : "");
  }

  function tick() {
    var el = document.getElementById("evboardClock");
    if (el) el.textContent = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" });
  }

  function start() {
    build();
    render();
    tick();
    setInterval(tick, 15000);
    setInterval(render, 2000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
