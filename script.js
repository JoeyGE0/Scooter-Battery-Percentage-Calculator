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

// Load saved settings
window.addEventListener("DOMContentLoaded", () => {
  const saved = JSON.parse(localStorage.getItem("batterySettings"));
  if (saved) {
    batteryType.value = saved.batteryType;
    cellMax.value = saved.cellMax;
    cellNominal.value = saved.cellNominal;
    cellMin.value = saved.cellMin;
    cutoff.value = saved.cutoff;
  }
  update();
});

function getPercentage(v, s, maxV, minV, cutoffV) {
  const perCell = v / s;
  if (cutoffV && v <= cutoffV) return 0;
  const clamped = Math.max(minV, Math.min(maxV, perCell));
  return Math.round(((clamped - minV) / (maxV - minV)) * 100);
}

function getBatteryTips(v, s, maxV, minV) {
  const perCell = v / s;
  if (perCell > maxV + 0.05) return "⚠️ Voltage too high — double check battery type or charger settings!";
  if (perCell < minV - 0.2) return "⚠️ Battery dangerously low. Don’t charge — balance or check each cell first.";
  if (perCell < minV) return "⚠️ Battery very low — may be unsafe to ride or charge.";
  if (perCell < minV + 0.15) return "🔋 Very low. Avoid hard riding. Charge soon.";
  if (perCell > maxV - 0.1) return "✅ Fully charged or very close.";
  return "";
}

function update() {
  let v = parseFloat(voltageInput.value.replace(/[^\d.]/g, ""));
  const s = Math.round(parseFloat(batteryType.value) / 3.6);
  const maxV = parseFloat(cellMax.value);
  const minV = parseFloat(cellMin.value);
  const cut = parseFloat(cutoff.value) || 0;

  // Save settings
  localStorage.setItem(
    "batterySettings",
    JSON.stringify({
      batteryType: batteryType.value,
      cellMax: cellMax.value,
      cellNominal: cellNominal.value,
      cellMin: cellMin.value,
      cutoff: cutoff.value,
    })
  );

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

  // Smooth gradient color
  const green = Math.round((percent / 100) * 200);
  const red = 200 - green;
  batteryFill.style.background = `rgb(${red},${green},60)`;

  // Voltage info
  const perCell = (v / s).toFixed(3);
  rangeInfo.innerText = `Per-cell: ${perCell} V`;

  clearTimeout(tipTimeout);
  tipTimeout = setTimeout(() => {
    tips.innerText = getBatteryTips(v, s, maxV, minV);
  }, 1000);
}

// Input restrictions: allow numbers and "v" or "V"
voltageInput.addEventListener("input", () => {
  voltageInput.value = voltageInput.value.replace(/[^0-9.vV]/g, "");
  update();
});

// Trigger update on all other changes
[batteryType, cellMax, cellNominal, cellMin, cutoff].forEach((el) =>
  el.addEventListener("input", update)
);
