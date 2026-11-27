import sys

path = r"C:\Users\Digi Face\.gemini\antigravity\scratch\cesag-eval-plateforme\public\js\app.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update initDakarWeather
old_weather = """        if (icon) icon.textContent = ic;
        text.textContent = `Dakar ${temp}°C`;
      }
    })
    .catch(() => {
      text.textContent = "Dakar 28°C";
    });"""

new_weather = """        if (icon) icon.textContent = ic;
        text.setAttribute("data-temp", String(temp));
        const isCockpit = document.body.classList.contains("mode-cockpit");
        text.textContent = isCockpit ? `GOBD / DSS · ${temp}°C · CAVOK` : `Dakar ${temp}°C`;
      }
    })
    .catch(() => {
      text.setAttribute("data-temp", "28");
      const isCockpit = document.body.classList.contains("mode-cockpit");
      text.textContent = isCockpit ? "GOBD / DSS · 28°C · CAVOK" : "Dakar 28°C";
    });"""

if old_weather in content:
    content = content.replace(old_weather, new_weather, 1)
    print("Updated initDakarWeather")
else:
    print("WARNING: old_weather not found")

# 2. Update renderSelectedModules button text
old_btn = '    $("btnSubmitDeclarations").textContent = `🚀 Envoyer le signal pour programmation (${count} module${count > 1 ? "s" : ""})`;'
new_btn = '    const isCockpit = document.body.classList.contains("mode-cockpit");\n    $("btnSubmitDeclarations").textContent = isCockpit ? `🛫 Autorisation de décollage · Transmettre signal (${count} module${count > 1 ? "s" : ""})` : `🚀 Envoyer le signal pour programmation (${count} module${count > 1 ? "s" : ""})`;'

if old_btn in content:
    content = content.replace(old_btn, new_btn, 1)
    print("Updated button text")
else:
    print("WARNING: old_btn not found")

# 3. Update handleSubmitDeclarations success toast & takeoff
old_submit_toast = """      const res = await apiCreateDeclarations(payloadItems, force);
      showToast(`${res.added || payloadItems.length} module(s) enregistré(s) dans « À programmer » !`);"""
new_submit_toast = """      const res = await apiCreateDeclarations(payloadItems, force);
      triggerFlightTakeoff();
      const isCockpit = document.body.classList.contains("mode-cockpit");
      const msg = isCockpit
        ? `🛫 Vol autorisé 5/5 : ${res.added || payloadItems.length} module(s) transmis à la Tour de Contrôle Oscar Kakpo !`
        : `${res.added || payloadItems.length} module(s) enregistré(s) dans « À programmer » !`;
      showToast(msg);"""

if old_submit_toast in content:
    content = content.replace(old_submit_toast, new_submit_toast, 1)
    print("Updated submit toast")
else:
    print("WARNING: old_submit_toast not found")

# 4. Insert aviation helpers
aviation_helpers = """
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
"""

init_marker = "  async function init() {"
if init_marker in content and "function playCabinChime" not in content:
    content = content.replace(init_marker, aviation_helpers + "\n" + init_marker, 1)
    print("Inserted aviation helpers")

old_init_calls = "    initDakarWeather();\n    initQrCodeModal();"
new_init_calls = "    initDakarWeather();\n    initQrCodeModal();\n    initCockpitMode();"
if old_init_calls in content:
    content = content.replace(old_init_calls, new_init_calls, 1)
    print("Added initCockpitMode to init()")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Finished updating app.js")
