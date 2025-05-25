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

function getPercentage(v, s, maxV, minV, cutoffV) {
  if (cutoffV && v <= cutoffV) return 0;
  const perCell = v / s;
  const clamped = Math.max(minV, Math.min(maxV, perCell));
  return Math.round(((clamped - minV) / (maxV - minV)) * 100);
}

function getBatteryTips(v, s, maxV, minV) {
  const perCell = v / s;
  if (perCell > maxV + 0.05) return "⚠️ Voltage too high — double check battery type or charger settings!";
  if (perCell < minV - 0.2) return "⚠️ Battery dangerously low. Do NOT charge or ride — cells could be damaged.";
  if (perCell < minV) return "⚠️ Battery very low — unsafe to ride or charge.";
  if (perCell < minV + 0.15) return "🔋 Very low. Avoid hard riding. Charge soon.";
  if (perCell > maxV - 0.1) return "✅ Fully charged or very close.";
  return "";
}

function saveSettings() {
  localStorage.setItem("batteryType", batteryType.value);
  localStorage.setItem("cellMax", cellMax.value);
  localStorage.setItem("cellNominal", cellNominal.value);
  localStorage.setItem("cellMin", cellMin.value);
  localStorage.setItem("cutoff", cutoff.value);
}

function loadSettings() {
  if (localStorage.getItem("batteryType")) batteryType.value = localStorage.getItem("batteryType");
  if (localStorage.getItem("cellMax")) cellMax.value = localStorage.getItem("cellMax");
  if (localStorage.getItem("cellNominal")) cellNominal.value = localStorage.getItem("cellNominal");
  if (localStorage.getItem("cellMin")) cellMin.value = localStorage.getItem("cellMin");
  if (localStorage.getItem("cutoff")) cutoff.value = localStorage.getItem("cutoff");
}

function update() {
  const v = parseFloat(voltageInput.value);
  const maxV = parseFloat(cellMax.value);
  const minV = parseFloat(cellMin.value);
  const cut = parseFloat(cutoff.value) || 0;

  const seriesCountMap = {
    "36": 10,
    "48": 13,
    "52": 14,
    "60": 16,
    "72": 20,
    "84": 24
  };

  const s = seriesCountMap[batteryType.value];

  if (isNaN(v) || v <= 0 || !s) {
    batteryPercent.innerText = "0%";
    batteryFill.style.width = "0%";
    batteryFill.style.background = "#555";
    rangeInfo.innerText = "Nominal: ~0%";
    tips.innerText = "";
    return;
  }

  const perCell = v / s;
  const clamped = Math.max(minV, Math.min(maxV, perCell));
  
  // Only this line changed:
  const percent = v <= cut ? 0 : Math.round(((clamped - cut) / (maxV - cut)) * 100);

  batteryPercent.innerText = `${percent}%`;
  batteryFill.style.width = `${percent}%`;

  const green = Math.round((percent / 100) * 200);
  const red = 200 - green;
  batteryFill.style.background = `rgb(${red},${green},60)`;

  rangeInfo.innerText = `Per-cell: ${perCell.toFixed(2)} V`;

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

loadSettings();
update();
