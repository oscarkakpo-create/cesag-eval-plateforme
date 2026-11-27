/* Remplace les emojis par des icônes SVG professionnelles (jeu Lucide, licence ISC).
   Fonctionne aussi sur le contenu généré dynamiquement par app.js. */
(function () {
  var P = {
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    rain: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 14v6M8 14v6M12 16v6"/>',
    wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8M16 17H8M10 9H8"/>',
    folder: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    cap: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    check: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    pointer: '<path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-4 0"/><path d="M14 10V9a2 2 0 0 0-4 0v1"/><path d="M10 9.5V4a2 2 0 0 0-4 0v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
  };
  var MAP = {
    '📥': 'download', '🏛': 'landmark', '🔒': 'lock', '🔓': 'unlock', '✈': 'plane', '🛫': 'plane',
    '🔔': 'bell', '⚡': 'zap', '🚀': 'send', '☀': 'sun', '🌤': 'cloud', '🌫': 'cloud', '🌧': 'rain',
    '🌦': 'rain', '💨': 'wind', '🏠': 'home', '✍': 'pen', '❓': 'help', '📄': 'file', '📂': 'folder',
    '📘': 'book', '🎓': 'cap', '💼': 'briefcase', '📧': 'mail', '🗓': 'calendar', '☑': 'check',
    '📋': 'clipboard', '👆': 'pointer', '★': 'star'
  };
  var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
  var RE = new RegExp('(' + keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')️?\\s?', 'g');
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, SELECT: 1, TITLE: 1, svg: 1 };

  function svg(name) {
    return '<svg class="ico ico-' + name + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[name] + '</svg>';
  }
  function process(node) {
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    var list = [], n;
    while ((n = walker.nextNode())) { RE.lastIndex = 0; if (RE.test(n.nodeValue)) list.push(n); }
    list.forEach(function (t) {
      var p = t.parentNode;
      if (!p) return;
      RE.lastIndex = 0;
      if (SKIP[p.nodeName] || p.closest('select,textarea,svg')) { t.nodeValue = t.nodeValue.replace(RE, ''); return; }
      var span = document.createElement('span');
      span.className = 'ico-wrap';
      var esc = t.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      span.innerHTML = esc.replace(RE, function (m, e) { return svg(MAP[e]); });
      p.replaceChild(span, t);
      span.replaceWith.apply(span, Array.prototype.slice.call(span.childNodes));
    });
  }
  function run() {
    process(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === 'characterData') { if (m.target.parentNode) process(m.target.parentNode); }
        else m.addedNodes.forEach(function (a) {
          if (a.nodeType === 3 && a.parentNode) process(a.parentNode);
          else if (a.nodeType === 1 && a.nodeName !== 'svg') process(a);
        });
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
