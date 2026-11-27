path = r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\public\js\app.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update bindEvents tab switching
old_tab_click = """    // Tab switching
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        $(`tab-${tab.dataset.tab}`).classList.add("active");
      });
    });"""

new_tab_click = """    // Tab switching with password protection for restricted tabs
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
    });"""

if old_tab_click in content:
    content = content.replace(old_tab_click, new_tab_click, 1)
    print("Updated tab switching with password check")
else:
    print("WARNING: old_tab_click not found")

# 2. Add guide & auth logic
new_features = """
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
"""

marker = "  async function init() {"
if marker in content and "function initGuideModal" not in content:
    content = content.replace(marker, new_features + "\n" + marker, 1)
    print("Inserted new_features")

old_init_calls = "    initDakarWeather();\n    initCockpitMode();"
new_init_calls = "    initDakarWeather();\n    initCockpitMode();\n    initGuideModal();\n    initPlanningAuth();"
if old_init_calls in content:
    content = content.replace(old_init_calls, new_init_calls, 1)
    print("Added initGuideModal and initPlanningAuth to init()")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated app.js successfully")
