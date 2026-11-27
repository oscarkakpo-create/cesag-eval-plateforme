/* Tableau des départs « CESAG Évaluations » — style aéroport.
   Chaque déclaration est un « vol » ; le statut devient un statut de vol.
   Aucune donnée personnelle (ni enseignant, ni e-mail) n'est affichée. */
(function () {
  var STATUS = {
    A_programmer: { label: "EMBARQUEMENT", cls: "st-board" },
    Programmee:   { label: "EN VOL",       cls: "st-fly" },
    Realisee:     { label: "ATTERRI",      cls: "st-land" },
    Annulee:      { label: "ANNULÉ",       cls: "st-cancel" }
  };
  var GATE = { Licence: "L", Master: "M", MBA: "E" };
  var MAX_ROWS = 14;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function flightNo(d, i) {
    var code = String(d.code_ecue || "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(-4);
    return "CS " + (code || String(100 + i));
  }
  function hhmm(v) {
    if (!v) return "--:--";
    var dt = new Date(v);
    if (isNaN(dt)) return "--:--";
    return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Africa/Dakar" });
  }

  function build() {
    var host = document.querySelector("#tab-accueil .landing-stats-strip");
    if (!host || document.getElementById("cesagBoard")) return;
    var wrap = document.createElement("section");
    wrap.id = "cesagBoard";
    wrap.className = "fids";
    wrap.setAttribute("aria-label", "Tableau des départs des évaluations");
    wrap.innerHTML =
      '<div class="fids-head">' +
        '<div class="fids-title"><span class="fids-plane">✈️</span><div><strong>Départs</strong><span>Évaluations des enseignements · CESAG</span></div></div>' +
        '<div class="fids-clock"><span id="fidsClock">--:--</span><small>Heure de Dakar</small></div>' +
      '</div>' +
      '<div class="fids-cols"><span>Vol</span><span>Destination</span><span class="c-classe">Classe</span><span>Porte</span><span>Date</span><span>Statut</span></div>' +
      '<div class="fids-viewport"><div class="fids-rows" id="fidsRows"></div></div>' +
      '<div class="fids-ticker"><div class="fids-ticker-track" id="fidsTicker"></div></div>';
    host.parentNode.insertBefore(wrap, host.nextSibling);
  }

  function render() {
    var st = window.CESAG_STATE;
    var rowsEl = document.getElementById("fidsRows");
    if (!st || !rowsEl) return;
    var list = (st.declarations || []).slice().sort(function (a, b) {
      return String(b.date_declaration || b.created_at || b.date_fin_module || "").localeCompare(String(a.date_declaration || a.created_at || a.date_fin_module || ""));
    }).slice(0, MAX_ROWS);

    var sig = list.map(function (d) { return d.id + d.statut; }).join("|");
    if (sig === rowsEl.dataset.sig) return;
    rowsEl.dataset.sig = sig;

    var html;
    if (!list.length) {
      html = '<div class="fids-row fids-empty">Aucun vol programmé pour le moment · déclarez un cours terminé pour ouvrir l\'embarquement</div>';
    } else {
      html = list.map(function (d, i) {
        var s = STATUS[d.statut] || STATUS.A_programmer;
        return '<div class="fids-row">' +
          '<span class="f-no">' + esc(flightNo(d, i)) + '</span>' +
          '<span class="f-dest">' + esc(d.module || d.code_ecue || "Module") + '</span>' +
          '<span class="f-classe c-classe">' + esc(d.classe || d.programme || "") + '</span>' +
          '<span class="f-gate">' + esc(GATE[d.niveau] || "—") + '</span>' +
          '<span class="f-date">' + esc(hhmm(d.date_ouverture || d.date_fin_module)) + '</span>' +
          '<span class="f-status ' + s.cls + '">' + s.label + '</span>' +
        '</div>';
      }).join("");
      // Liste doublée pour un défilement continu sans saut
      if (list.length > 5) html = html + html;
    }
    rowsEl.innerHTML = html;
    rowsEl.classList.toggle("is-scrolling", list.length > 5);
    rowsEl.style.setProperty("--fids-duration", Math.max(18, list.length * 3.2) + "s");

    var c = { A_programmer: 0, Programmee: 0, Realisee: 0 };
    (st.declarations || []).forEach(function (d) { if (c[d.statut] != null) c[d.statut]++; });
    var msgs = [
      "Bienvenue à bord de la plateforme d'évaluation des enseignements du CESAG",
      c.A_programmer + " vol(s) en embarquement · " + c.Programmee + " en vol · " + c.Realisee + " atterri(s)",
      "Porte L : Licences · Porte M : Masters · Porte E : MBA & Executive",
      "Cours terminé ? Donnez le signal : la tour de contrôle programme votre évaluation sur Moodle",
      "Météo campus Dakar : visibilité excellente pour vos évaluations"
    ];
    var t = msgs.map(function (m) { return "<span>" + esc(m) + "</span>"; }).join('<span class="sep">✈️</span>');
    document.getElementById("fidsTicker").innerHTML = t + '<span class="sep">✈️</span>' + t;
  }

  function tick() {
    var el = document.getElementById("fidsClock");
    if (el) el.textContent = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Dakar" });
  }

  function start() {
    build();
    render();
    tick();
    setInterval(tick, 1000);
    setInterval(render, 4000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
