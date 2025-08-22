// DOM Elements
const voltageInput = document.getElementById("voltageInput");
const batteryType = document.getElementById("batteryType");
const batteryFill = document.getElementById("batteryFill");
const batteryPercentText = document.getElementById("batteryPercent");
const voltageDisplay = document.getElementById("voltageDisplay");
const statusText = document.getElementById("statusText");

// Advanced settings
const cellMax = document.getElementById("cellMax");
const cellNominal = document.getElementById("cellNominal");
const cellMin = document.getElementById("cellMin");
const controllerCutoff = document.getElementById("controllerCutoff");

// Advanced toggle
const advancedToggle = document.getElementById("advancedToggle");
const advancedPanel = document.getElementById("advancedPanel");

// Tips
const tipCard = document.getElementById("tipCard");
const tipIcon = document.getElementById("tipIcon");
const tipTitle = document.getElementById("tipTitle");
const tipText = document.getElementById("tipText");

// Reference grid
const referenceGrid = document.getElementById("referenceGrid");

// State
let tipTimeout;
let isAdvancedOpen = false;

// Battery configurations for different types
const batteryConfigs = {
  36: { name: "36V", cells: 10, nominal: 36 },
  48: { name: "48V", cells: 13, nominal: 48 },
  52: { name: "52V", cells: 14, nominal: 52 },
  60: { name: "60V", cells: 16, nominal: 60 },
  72: { name: "72V", cells: 20, nominal: 72 }
};

// Initialize the app
function init() {
  updateBattery();
  generateReferenceGrid();
  loadSettings();
  
  // Add event listeners
  voltageInput.addEventListener("input", updateBattery);
  batteryType.addEventListener("change", updateBattery);
  cellMax.addEventListener("input", updateBattery);
  cellNominal.addEventListener("input", updateBattery);
  cellMin.addEventListener("input", updateBattery);
  controllerCutoff.addEventListener("input", updateBattery);
  
  // Add input validation
  addInputValidation();
  
  // Focus on voltage input for better UX
  voltageInput.focus();
}

// Toggle advanced settings
function toggleAdvanced() {
  isAdvancedOpen = !isAdvancedOpen;
  
  if (isAdvancedOpen) {
    advancedPanel.classList.add("open");
    advancedToggle.classList.add("active");
  } else {
    advancedPanel.classList.remove("open");
    advancedToggle.classList.remove("active");
  }
}

// Update battery display and calculations
function updateBattery() {
  const voltage = parseFloat(voltageInput.value);
  const type = parseInt(batteryType.value);
  const config = batteryConfigs[type];
  
  // Get cell voltages
  const maxCell = parseFloat(cellMax.value);
  const nominalCell = parseFloat(cellNominal.value);
  const minCell = parseFloat(cellMin.value);
  const cutoff = parseFloat(controllerCutoff.value);

  // Calculate battery limits
  const cells = config.cells;
  const vMax = cells * maxCell;
  const vNominal = cells * nominalCell;
  
  // Controller cutoff affects percentage accuracy (when scooter stops working)
  // If set, it becomes the "0%" point even if battery has more voltage left
  const vMin = cutoff > 0 ? cutoff : cells * minCell;
  
  // Update voltage display
  if (!isNaN(voltage)) {
    voltageDisplay.textContent = `${voltage.toFixed(1)}V`;
  } else {
    voltageDisplay.textContent = "-- V";
  }
  
  // Calculate percentage
  let percent = 0;
  let status = "Enter voltage to start";
  
  if (!isNaN(voltage)) {
    if (voltage > vMax) {
      percent = 100;
      status = "Above full charge";
    } else if (voltage < vMin) {
      percent = 0;
      status = "Below minimum voltage";
    } else {
      percent = Math.min(Math.max(((voltage - vMin) / (vMax - vMin)) * 100, 0), 100);
      status = getStatusText(percent, voltage, vNominal);
    }
  }
  
  // Update battery visual
  batteryFill.style.width = `${percent}%`;
  batteryPercentText.textContent = `${Math.round(percent)}%`;
  statusText.textContent = status;
  
  // Update battery color based on percentage
  updateBatteryColor(percent);
  
  // Update tips with delay to avoid flicker
  clearTimeout(tipTimeout);
  tipTimeout = setTimeout(() => {
    updateTips(voltage, percent, vMin, vMax, vNominal);
  }, 300);
  
  // Update reference grid to show voltages around current reading
  generateReferenceGrid();
  
  // Save settings
  saveSettings();
}

// Get status text based on percentage and voltage
function getStatusText(percent, voltage, nominal) {
  if (percent >= 95) return "Fully charged";
  if (percent >= 80) return "Well charged";
  if (percent >= 60) return "Good charge";
  if (percent >= 40) return "Moderate charge";
  if (percent >= 20) return "Low charge";
  if (percent >= 10) return "Very low charge";
  return "Critical charge";
}

// Update battery color with smooth gradient
function updateBatteryColor(percent) {
  let hue, saturation, lightness;
  
  if (percent >= 80) {
    // Green for high charge
    hue = 120;
    saturation = 80;
    lightness = 50;
  } else if (percent >= 50) {
    // Yellow for medium charge
    hue = 60;
    saturation = 90;
    lightness = 55;
  } else if (percent >= 20) {
    // Orange for low charge
    hue = 30;
    saturation = 90;
    lightness = 55;
  } else {
    // Red for critical charge
    hue = 0;
    saturation = 90;
    lightness = 55;
  }
  
  batteryFill.style.background = `linear-gradient(90deg, hsl(${hue}, ${saturation}%, ${lightness}%), hsl(${hue + 20}, ${saturation}%, ${lightness + 5}%))`;
}

// Update tips based on battery state
function updateTips(voltage, percent, vMin, vMax, vNominal) {
  let icon, title, text, type = "info";
  
  if (isNaN(voltage)) {
    icon = "💡";
    title = "Ready to calculate";
    text = "Enter your battery voltage above to get started";
  } else if (voltage <= 0) {
    icon = "❌";
    title = "Invalid voltage";
    text = "Voltage must be greater than 0V. Check your multimeter or voltage reading.";
    type = "warning";
  } else if (voltage > 120) {
    icon = "🚨";
    title = "DANGER - Extremely high voltage";
    text = "This voltage is dangerously high and could cause fire or explosion. DO NOT charge. Check for wiring issues or wrong battery type.";
    type = "warning";
  } else if (voltage > vMax * 1.08) {
    icon = "🚨";
    title = "DANGER - Severely overcharged";
    text = "Voltage is dangerously high. This could damage your battery permanently or cause a fire. DO NOT charge. Check your battery type.";
    type = "warning";
  } else if (voltage > vMax * 1.05) {
    icon = "🚨";
    title = "DANGER - Overcharged";
    text = "Voltage exceeds safe maximum. This could damage your battery. Unplug immediately and let rest. Check charger output.";
    type = "warning";
  } else if (voltage > vMax * 1.02) {
    icon = "⚠️";
    title = "Above full charge";
    text = "Voltage is slightly above full charge. This is often surface charge after charging. Let rest 15-30 min; voltage should settle.";
    type = "warning";
  } else if (voltage >= vMax * 0.98) {
    icon = "✅";
    title = "Fully charged";
    text = "Your battery is fully charged and ready to go! If not riding soon, consider charging to 80-90% for longevity.";
    type = "success";
  } else if (voltage >= vMax * 0.92) {
    icon = "✅";
    title = "Well charged";
    text = "Battery is well charged and ready for a good ride. This is a great starting point.";
    type = "success";
  } else if (voltage >= vMax * 0.85) {
    icon = "📊";
    title = "Good charge";
    text = "Battery has a good charge level. Perfect for normal riding conditions.";
    type = "info";
  } else if (voltage >= vMax * 0.78) {
    icon = "📊";
    title = "Moderate charge";
    text = "Battery has moderate charge. Fine for shorter rides, but consider charging soon.";
    type = "info";
  } else if (voltage >= vMax * 0.70) {
    icon = "📉";
    title = "Below half";
    text = "Battery is below half charge. Plan your route accordingly and charge soon.";
    type = "info";
  } else if (voltage >= vMax * 0.62) {
    icon = "⚠️";
    title = "Low charge";
    text = "Battery is getting low. Consider charging soon to avoid deep discharge.";
    type = "warning";
  } else if (voltage >= vMax * 0.55) {
    icon = "⚠️";
    title = "Very low charge";
    text = "Battery is very low. Charge soon to prevent controller cutoff and cell damage.";
    type = "warning";
  } else if (voltage >= vMax * 0.48) {
    icon = "🔋";
    title = "Critical charge";
    text = "Battery is critically low. Charge immediately to prevent controller cutoff.";
    type = "warning";
  } else if (voltage >= vMax * 0.40) {
    icon = "🚨";
    title = "Extremely low";
    text = "Battery is extremely low. Charge NOW to prevent permanent cell damage.";
    type = "warning";
  } else if (voltage >= vMax * 0.32) {
    icon = "🚨";
    title = "DANGER - Very low";
    text = "Voltage is dangerously low. Charging may be unsafe. Check each cell individually before attempting to charge.";
    type = "warning";
  } else if (voltage >= vMax * 0.25) {
    icon = "🚨";
    title = "DANGER - Severely low";
    text = "Voltage is severely low. Cells may be permanently damaged. Charging could be dangerous - seek professional advice.";
    type = "warning";
  } else if (voltage >= vMin) {
    icon = "🚨";
    title = "Near cutoff";
    text = "Battery is near the cutoff voltage. Scooter may stop working. Charge immediately.";
    type = "warning";
  } else if (voltage >= vMin * 0.98) {
    icon = "🚨";
    title = "Below cutoff";
    text = "Voltage is below the usable level. Scooter will stop working. Charge immediately.";
    type = "warning";
  } else if (voltage >= vMin * 0.95) {
    icon = "🚨";
    title = "Severely discharged";
    text = "Voltage is severely low. Battery cells may be damaged. Check each cell individually.";
    type = "warning";
  } else if (voltage >= vMin * 0.90) {
    icon = "🚨";
    title = "CRITICAL - Deeply discharged";
    text = "Voltage is critically low. Cells may be permanently damaged. Charging could be unsafe.";
    type = "warning";
  } else if (voltage >= vMin * 0.85) {
    icon = "🚨";
    title = "DANGER - Extremely discharged";
    text = "Voltage is extremely low. Charging this battery could be dangerous. Seek professional advice.";
    type = "warning";
  } else if (voltage >= vMin * 0.80) {
    icon = "🚨";
    title = "DANGER - Battery may be destroyed";
    text = "Voltage is critically low. Battery may be permanently damaged and unsafe to charge.";
    type = "warning";
  } else {
    icon = "🚨";
    title = "DANGER - DO NOT CHARGE";
    text = "Voltage is extremely low. Charging this battery could cause fire or explosion. Battery is likely destroyed.";
    type = "warning";
  }
  
  // Update tip card
  tipIcon.textContent = icon;
  tipTitle.textContent = title;
  tipText.textContent = text;
  
  // Update tip card styling
  tipCard.className = `tip-card ${type}`;
}

// Generate reference grid with common voltage points
function generateReferenceGrid() {
  const type = parseInt(batteryType.value);
  const config = batteryConfigs[type];
  const maxCell = parseFloat(cellMax.value);
  const minCell = parseFloat(cellMin.value);
  const cutoff = parseFloat(controllerCutoff.value);
  
  const cells = config.cells;
  const vMax = cells * maxCell;
  // Controller cutoff affects percentage accuracy - becomes the "0%" point
  const vMin = cutoff > 0 ? cutoff : cells * minCell;
  
  const currentVoltage = parseFloat(voltageInput.value);
  
  // Generate reference points around the current voltage
  let referencePoints = [];
  
  if (!isNaN(currentVoltage) && currentVoltage > 0) {
    // Show voltages around the current reading
    const step = Math.max(1, Math.round(currentVoltage * 0.05)); // 5% of current voltage as step
    const start = Math.max(vMin, currentVoltage - step * 3);
    const end = Math.min(vMax, currentVoltage + step * 3);
    
    for (let v = start; v <= end; v += step) {
      const percent = Math.min(Math.max(((v - vMin) / (vMax - vMin)) * 100, 0), 100);
      const label = v === currentVoltage ? "CURRENT" : `${Math.round(percent)}%`;
      referencePoints.push({ voltage: v, percent: percent, label: label, isCurrent: v === currentVoltage });
    }
  } else {
    // Default reference points when no voltage entered
    referencePoints = [
      { voltage: vMax, percent: 100, label: "Full" },
      { voltage: vMax * 0.9, percent: 90, label: "90%" },
      { voltage: vMax * 0.8, percent: 80, label: "80%" },
      { voltage: vMax * 0.6, percent: 60, label: "60%" },
      { voltage: vMax * 0.4, percent: 40, label: "40%" },
      { voltage: vMax * 0.2, percent: 20, label: "20%" },
      { voltage: vMin, percent: 0, label: "Empty" }
    ];
  }
  
  referenceGrid.innerHTML = referencePoints.map(point => `
    <div class="reference-item ${point.isCurrent ? 'current-voltage' : ''}">
      <div class="reference-voltage">${point.voltage.toFixed(1)}V</div>
      <div class="reference-percent">${point.label}</div>
    </div>
  `).join("");
}

// Save settings to localStorage
function saveSettings() {
  const settings = {
    batteryType: batteryType.value,
    cellMax: cellMax.value,
    cellNominal: cellNominal.value,
    cellMin: cellMin.value,
    controllerCutoff: controllerCutoff.value,
    isAdvancedOpen: isAdvancedOpen
  };
  
  localStorage.setItem("batteryCalcSettings", JSON.stringify(settings));
}

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem("batteryCalcSettings");
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      
      batteryType.value = settings.batteryType || "72";
      cellMax.value = settings.cellMax || "4.2";
      cellNominal.value = settings.cellNominal || "3.7";
      cellMin.value = settings.cellMin || "3.0";
      controllerCutoff.value = settings.controllerCutoff || "0";
      
      if (settings.isAdvancedOpen) {
        toggleAdvanced();
      }
    } catch (e) {
      console.log("Could not load saved settings");
    }
  }
}

// Add input validation to prevent bad values
function addInputValidation() {
  // Voltage input validation
  voltageInput.addEventListener("blur", function() {
    const value = parseFloat(this.value);
    if (value < 0) {
      this.value = "";
      this.placeholder = "Enter positive voltage";
    } else if (value > 200) {
      this.value = "";
      this.placeholder = "Voltage too high (>200V)";
    }
  });
  
  // Add safety warning for very low voltages
  voltageInput.addEventListener("input", function() {
    const value = parseFloat(this.value);
    if (value > 0 && value < 30) {
      this.style.borderColor = "#f56565";
      this.title = "WARNING: Very low voltage detected. This battery may be damaged and unsafe to charge.";
    } else {
      this.style.borderColor = "";
      this.title = "";
    }
  });
  
  // Cell voltage validation
  cellMax.addEventListener("blur", function() {
    const value = parseFloat(this.value);
    if (value < 3.0 || value > 5.0) {
      this.value = "4.2";
      updateBattery();
    }
  });
  
  cellNominal.addEventListener("blur", function() {
    const value = parseFloat(this.value);
    if (value < 3.0 || value > 4.5) {
      this.value = "3.7";
      updateBattery();
    }
  });
  
  cellMin.addEventListener("blur", function() {
    const value = parseFloat(this.value);
    if (value < 2.5 || value > 3.5) {
      this.value = "3.0";
      updateBattery();
    }
  });
  
  // Controller cutoff validation
  controllerCutoff.addEventListener("blur", function() {
    const value = parseFloat(this.value);
    if (value < 0) {
      this.value = "0";
      updateBattery();
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
