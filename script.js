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

// Save settings to localStorage (except voltage)
function saveSettings() {
  const settings = {
    batteryType: batteryType.value,
    cellMax: cellMax.value,
    cellNominal: cellNominal.value,
    cellMin: cellMin.value,
    cutoff: cutoff.value,
  };
  localStorage.setItem("batterySettings", JSON.stringify(settings));
}

// Load settings from localStorage
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem("batterySettings"));
  if (settings) {
    batteryType.value = settings.batteryType || batteryType.value;
    cellMax.value = settings.cellMax || cellMax.value;
    cellNominal.value = settings.cellNominal || cellNominal.value;
    cellMin.value = settings.cellMin || cellMin.value;
    cutoff.value = settings.cutoff || cutoff.value;
  }
}

function getPercentage(voltage, totalCells, maxV, minV, cutoffV) {
  if (cutoffV && voltage <= cutoffV) return 0;
  const perCell = voltage / totalCells;
  const clamped = Math.max(minV, Math.min(maxV, perCell));
  return Math.round(((clamped - minV) / (maxV - minV)) * 100);
}

function getBatteryTips(voltage, totalCells, maxV, minV) {
  const perCell = voltage / totalCells;
  if (perCell > maxV + 0.05) return "⚠️ Voltage too high — double check battery type or charger settings!";
  if (perCell < minV - 0.2) return "⚠️ Voltage critically low. Battery might be damaged. Do NOT charge or ride.";
  if (perCell < minV) return "⚠️ Voltage very low — unsafe to ride or charge.";
  if (perCell < minV + 0.15) return "🔋 Low voltage. Charge soon and avoid heavy use.";
  if (perCell > maxV - 0.1) return "✅ Fully charged or very close.";
  return "";
}

function update() {
  const voltage = parseFloat(voltageInput.value);
  const totalCells = Math.round(parseFloat(batteryType.value) / 3.6);
  const maxV = parseFloat(cellMax.value);
  const minV = parseFloat(cellMin.value);
  const cut = parseFloat(cutoff.value) || 0;

  if (isNaN(voltage) || voltage <= 0) {
    batteryPercent.innerText = "0%";
    batteryFill.style.width = "0%";
    batteryFill.style.background = "#555";
    rangeInfo.innerText = "Nominal: ~0%";
    tips.innerText = "";
    return;
  }

  const percent = getPercentage(voltage, totalCells, maxV, minV, cut);
  batteryPercent.innerText = `${percent}%`;
  batteryFill.style.width = `${percent}%`;

  // Smooth gradient color
  const green = Math.round((percent / 100) * 200);
  const red = 200 - green;
  batteryFill.style.background = `rgb(${red},${green},60)`;

  // Voltage info
  const perCellV = (voltage / totalCells).toFixed(2);
  rangeInfo.innerText = `Per-cell voltage: ${perCellV} V`;

  clearTimeout(tipTimeout);
  tipTimeout = setTimeout(() => {
    tips.innerText = getBatteryTips(voltage, totalCells, maxV, minV);
  }, 1000);

  saveSettings();
}

[batteryType, cellMax, cellNominal, cellMin, cutoff].forEach(el =>
  el.addEventListener("input", () => {
    update();
    saveSettings();
  })
);

voltageInput.addEventListener("input", () => {
  update();
});

// Load saved settings on page load
loadSettings();
update();
