const batteryType = document.getElementById("batteryType");
const voltageInput = document.getElementById("voltage");
const cellMax = document.getElementById("cellMax");
const cellNominal = document.getElementById("cellNominal");
const cellMin = document.getElementById("cellMin");
const cutoff = document.getElementById("cutoff");
const batteryFill = document.getElementById("battery-fill");
const batteryPercent = document.getElementById("battery-percent");
const tips = document.getElementById("tips");
const rangeInfo = document.getElementById("rangeInfo");

let tipTimeout;

// Save settings to localStorage except voltage input
function saveSettings() {
  localStorage.setItem("batteryType", batteryType.value);
  localStorage.setItem("cellMax", cellMax.value);
  localStorage.setItem("cellNominal", cellNominal.value);
  localStorage.setItem("cellMin", cellMin.value);
  localStorage.setItem("cutoff", cutoff.value);
}

// Load settings from localStorage if exist
function loadSettings() {
  if (localStorage.getItem("batteryType")) batteryType.value = localStorage.getItem("batteryType");
  if (localStorage.getItem("cellMax")) cellMax.value = localStorage.getItem("cellMax");
  if (localStorage.getItem("cellNominal")) cellNominal.value = localStorage.getItem("cellNominal");
  if (localStorage.getItem("cellMin")) cellMin.value = localStorage.getItem("cellMin");
  if (localStorage.getItem("cutoff")) cutoff.value = localStorage.getItem("cutoff");
}

function getPercentage(v, s, maxV, minV, cutoffV) {
  if (cutoffV && v <= cutoffV) return 0;
  const clamped = Math.max(minV * s, Math.min(maxV * s, v));
  return Math.round(((clamped - minV * s) / ((maxV - minV) * s)) * 100);
}

function getBatteryTips(v, s, maxV, minV) {
  const perCell = v / s;
  if (perCell > maxV + 0.05) return "⚠️ Voltage too high — double check battery type or charger settings!";
  if (perCell < minV - 0.2) return "⚠️ Battery dangerously low. Do NOT charge or ride. Check each cell or battery health.";
  if (perCell < minV) return "⚠️ Battery very low — may be unsafe to ride or charge.";
  if (perCell < minV + 0.15) return "🔋 Very low. Avoid hard riding. Charge soon.";
  if (perCell > maxV - 0.1) return "✅ Fully charged or very close.";
  return "";
}

function update() {
  const v = parseFloat(voltageInput.value);
  const s = Math.round(parseFloat(batteryType.value) / 3.6);
  const maxV = parseFloat(cellMax.value);
  const minV = parseFloat(cellMin.value);
  const cut = parseFloat(cutoff.value) || 0;

  if (isNaN(v) || v <= 0) {
    batteryPercent.innerText = "0%";
    batteryFill.style.width = "0%";
    batteryFill.style.background = "#555";
    rangeInfo.innerText = "Nominal: ~0%";
    tips.innerText = "";
    return;
  }

  const percent = getPercentage(v, s, maxV, minV, cut);
  batteryPercent.innerText = `${percent}%`;
  batteryFill.style.width = `${percent}%`;

  // Smooth gradient color (red to green)
  const green = Math.round((percent / 100) * 200);
  const red = 200 - green;
  batteryFill.style.background = `rgb(${red},${green},60)`;

  // Voltage info per cell
  const perCell = (v / s).toFixed(2);
  rangeInfo.innerText = `Per-cell: ${perCell} V`;

  clearTimeout(tipTimeout);
  tipTimeout = setTimeout(() => {
    tips.innerText = getBatteryTips(v, s, maxV, minV);
  }, 1000);
  
  saveSettings();
}

[batteryType, cellMax, cellNominal, cellMin, cutoff].forEach((el) =>
  el.addEventListener("input", update)
);
voltageInput.addEventListener("input", update);

// Load saved settings on page load
loadSettings();
update();
