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
  loadSettings(); // Load settings FIRST before any updates
  updateBattery();
  generateReferenceGrid();
  
  // Add event listeners
  voltageInput.addEventListener("input", updateBattery);
  
  // Add contenteditable functionality to voltage display
  setupEditableVoltageDisplay();
  batteryType.addEventListener("change", () => {
    // Clear current voltage when switching battery types
    voltageInput.value = "";
    updateBattery();
    updateVoltagePlaceholder();
    // Save settings immediately when battery type changes
    saveSettings();
  });
  cellMax.addEventListener("input", updateBattery);
  cellNominal.addEventListener("input", updateBattery);
  cellMin.addEventListener("input", updateBattery);
  controllerCutoff.addEventListener("input", updateBattery);
  
  // Add input validation
  addInputValidation();
  
  // Focus on voltage input for better UX
  voltageInput.focus();
}

// Update voltage placeholder based on current battery type
function updateVoltagePlaceholder() {
  const lastVoltages = JSON.parse(localStorage.getItem("batteryLastVoltages") || "{}");
  const lastVoltageForType = lastVoltages[batteryType.value];
  
  if (lastVoltageForType) {
    voltageInput.placeholder = `e.g. ${lastVoltageForType}V`;
  } else {
    // Show nominal voltage for this battery type as default example
    const config = batteryConfigs[parseInt(batteryType.value)];
    const nominalVoltage = config.nominal;
    voltageInput.placeholder = `e.g. ${nominalVoltage}V`;
  }
}

// Update voltage input styling for dangerous undercharge
function updateVoltageInputStyling(voltage, vMin, vMax) {
  // Get current battery config for research-based thresholds
  const config = batteryConfigs[parseInt(batteryType.value)];
  const cells = config.cells;
  
  // Research-based voltage thresholds
  const maxSafeVoltage = cells * 4.2; // 4.2V per cell = 100% safe maximum
  const moderateDangerVoltage = cells * 4.3; // 4.3V per cell = high pressure, gas generation
  const fireRiskVoltage = cells * 4.5; // 4.5V per cell = severe thermal runaway risk
  const minSafeVoltage = cells * 3.0; // 3.0V per cell = safe minimum
  const damageVoltage = cells * 2.5; // 2.5V per cell = damage threshold
  
  // Check for dangerous states
  const isDangerouslyOvercharged = voltage >= fireRiskVoltage;
  const isModerateDanger = voltage >= moderateDangerVoltage;
  const isOvercharged = voltage > maxSafeVoltage;
  const isCriticallyLow = voltage <= damageVoltage && voltage > 0;
  const isDangerouslyLow = voltage < minSafeVoltage && voltage > damageVoltage;
  
  if (isDangerouslyOvercharged || isCriticallyLow) {
    // Dark red outline with intense pulsing for extreme danger
    voltageInput.style.borderColor = "#dc3545";
    voltageInput.style.boxShadow = "0 0 0 4px rgba(220, 53, 69, 0.4), 0 0 25px rgba(220, 53, 69, 0.6)";
    voltageInput.style.animation = "dangerPulse 0.8s infinite";
  } else if (isModerateDanger || isDangerouslyLow) {
    // Red outline with pulsing for dangerous states
    voltageInput.style.borderColor = "#cc0000";
    voltageInput.style.boxShadow = "0 0 0 4px rgba(204, 0, 0, 0.3), 0 0 20px rgba(204, 0, 0, 0.5)";
    voltageInput.style.animation = "dangerPulse 1s infinite";
  } else if (isOvercharged) {
    // Orange outline for basic overcharge
    voltageInput.style.borderColor = "#ff8c00";
    voltageInput.style.boxShadow = "0 0 0 4px rgba(255, 140, 0, 0.3), 0 0 15px rgba(255, 140, 0, 0.4)";
    voltageInput.style.animation = "dangerPulse 1.2s infinite";
  } else {
    // Normal - reset styling
    voltageInput.style.borderColor = "";
    voltageInput.style.boxShadow = "";
    voltageInput.style.animation = "none";
  }
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
  
  // Update voltage display (only if not currently being edited)
  const editableDisplay = document.querySelector('.voltage-value-editable');
  const isCurrentlyEditing = editableDisplay && document.activeElement === editableDisplay;
  
  if (!isCurrentlyEditing) {
    if (!isNaN(voltage)) {
      // Preserve original precision from input, but limit to 3 decimal places max
      const originalValue = voltageInput.value;
      if (originalValue && originalValue.includes('.')) {
        const decimalPlaces = Math.min(3, originalValue.split('.')[1].length);
        voltageDisplay.textContent = `${voltage.toFixed(decimalPlaces)}V`;
      } else {
        voltageDisplay.textContent = `${voltage.toFixed(1)}V`;
      }
    } else {
      voltageDisplay.textContent = "-- V";
    }
  }
  
  // Calculate percentage using more accurate lithium battery curve
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
      // Linear percentage calculation for lithium batteries
      // More accurate than arbitrary curves without proper discharge data
      const voltageRange = vMax - vMin;
      const voltageRatio = (voltage - vMin) / voltageRange;
      
      // Use simple linear interpolation - most accurate without specific discharge curve data
      // Real lithium curves vary significantly by chemistry, temperature, and age
      percent = Math.min(Math.max(voltageRatio * 100, 0), 100);
      status = getStatusText(percent, voltage, vNominal);
    }
  }
  
  // Update battery visual
  batteryFill.style.width = `${percent}%`;
  batteryPercentText.textContent = `${percent % 1 === 0 ? Math.round(percent) : percent.toFixed(1)}%`;
  statusText.textContent = status;
  
  // Update status pill styling based on battery level
  statusText.className = 'status-text';
  if (percent >= 80) {
    statusText.classList.add('success');
  } else if (percent >= 20) {
    // Default styling (no additional class)
  } else if (percent >= 10) {
    statusText.classList.add('warning');
  } else if (percent > 0) {
    statusText.classList.add('danger');
  }
  
  // Update battery color based on percentage
  updateBatteryColor(percent);
  
  // Update voltage input styling for dangerous undercharge
  updateVoltageInputStyling(voltage, vMin, vMax);
  
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
  
  // Check for overcharged/undercharged conditions
  const voltage = parseFloat(voltageInput.value);
  const hasVoltageEntered = !isNaN(voltage) && voltageInput.value.trim() !== '';
  const config = batteryConfigs[parseInt(batteryType.value)];
  const cells = config.cells;
  // Research-based voltage thresholds for lithium batteries
  const maxSafeVoltage = cells * 4.2; // 4.2V per cell = 100% safe maximum
  const moderateDangerVoltage = cells * 4.3; // 4.3V per cell = high pressure, gas generation
  const fireRiskVoltage = cells * 4.5; // 4.5V per cell = severe thermal runaway risk
  const minSafeVoltage = cells * 3.0; // 3.0V per cell = safe minimum
  const damageVoltage = cells * 2.5; // 2.5V per cell = damage threshold
  
  let isOvercharged = false;
  let isModerateDanger = false;
  let isDangerouslyOvercharged = false;
  let isDangerouslyLow = false;
  let isCriticallyLow = false;
  let isUnknown = false;
  let warningIcon = '';
  
  if (hasVoltageEntered) {
    if (voltage <= 0) { // 0V or negative = unknown/no reading (actively entered)
      isUnknown = true;
      warningIcon = 'question'; // Unknown status
    } else if (voltage >= fireRiskVoltage) { // >=4.5V per cell = SEVERE FIRE DANGER
      isDangerouslyOvercharged = true;
      warningIcon = 'fire'; // Severe thermal runaway risk
    } else if (voltage >= moderateDangerVoltage) { // >=4.3V per cell = moderate danger
      isModerateDanger = true;
      warningIcon = 'triangle'; // High pressure, gas generation
    } else if (voltage > maxSafeVoltage) { // >4.2V per cell = overcharge
      isOvercharged = true;
      warningIcon = 'triangle'; // Basic overcharge warning
    } else if (voltage <= damageVoltage) { // <=2.5V per cell = severe damage
      isCriticallyLow = true;
      warningIcon = 'triangle'; // Critical damage risk (NOT fire)
    } else if (voltage < minSafeVoltage) { // <3.0V per cell = undercharge
      isDangerouslyLow = true;
      warningIcon = 'triangle'; // Undercharge warning
    }
  }
  // No icon when field is empty - just show normal empty battery
  
  // Remove existing warning icon from battery body
  const batteryBody = document.querySelector('.battery-body');
  const existingIcon = batteryBody.querySelector('.battery-warning-icon');
  if (existingIcon) {
    existingIcon.remove();
  }
  
  // Apple-style dynamic battery colors and text
  if (isDangerouslyOvercharged) {
    // EXTREME RED for dangerously overcharged - fire risk
    batteryFill.style.background = 'linear-gradient(90deg, #dc143c, #8b0000)'; // Dark red
    batteryPercentText.style.color = '#dc143c'; // Dark red text
    // Add fire icon to battery body
    const icon = document.createElement('div');
    icon.className = 'battery-warning-icon fire-danger';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="fire-icon" viewBox="0 0 16 16">
      <path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16m0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15"/>
    </svg>`;
    batteryBody.appendChild(icon);
  } else if (isUnknown) {
    // Default colors for unknown/0V
    batteryPercentText.style.color = '#f2f2f7'; // White text
    // Add question mark icon to battery body
    const icon = document.createElement('div');
    icon.className = 'battery-warning-icon unknown';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="question-mark" viewBox="0 0 16 16">
      <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286m1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94"/>
    </svg>`;
    batteryBody.appendChild(icon);
  } else if (isModerateDanger) {
    // DARK RED for moderate danger (4.3V per cell - high pressure, gas generation)
    batteryFill.style.background = 'linear-gradient(90deg, #cc0000, #ff3b30)'; // Dark red gradient
    batteryPercentText.style.color = '#cc0000'; // Dark red text
    // Add warning icon to battery body
    const icon = document.createElement('div');
    icon.className = 'battery-warning-icon moderate-danger';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="warning-triangle" viewBox="0 0 16 16">
      <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
    </svg>`;
    batteryBody.appendChild(icon);
  } else if (isOvercharged) {
    // ORANGE for basic overcharge (4.2V+ per cell)
    batteryFill.style.background = 'linear-gradient(90deg, #ff8c00, #ff6600)'; // Orange gradient
    batteryPercentText.style.color = '#ff8c00'; // Orange text
    // Add warning icon to battery body
    const icon = document.createElement('div');
    icon.className = 'battery-warning-icon overcharge';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="warning-triangle" viewBox="0 0 16 16">
      <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
    </svg>`;
    batteryBody.appendChild(icon);
  } else if (isCriticallyLow) {
    // WARNING TRIANGLE for critically low (<=2.5V per cell - severe damage risk, NOT fire)
    batteryFill.style.background = 'linear-gradient(90deg, #8b0000, #ff0000)'; // Dark red gradient
    batteryPercentText.style.color = '#ff0000'; // Bright red text
    // Add warning triangle icon to battery body
    const icon = document.createElement('div');
    icon.className = 'battery-warning-icon critical-low';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="warning-triangle" viewBox="0 0 16 16">
      <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
    </svg>`;
    batteryBody.appendChild(icon);
  } else if (isDangerouslyLow) {
    // RED for dangerously low
    batteryFill.style.background = 'linear-gradient(90deg, #ff453a, #ff3b30)'; // Bright red
    batteryPercentText.style.color = '#ff453a'; // Red text
    // Add warning icon to battery body
    const icon = document.createElement('div');
    icon.className = 'battery-warning-icon danger';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="warning-triangle" viewBox="0 0 16 16">
      <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
    </svg>`;
    batteryBody.appendChild(icon);
  } else if (percent >= 80) {
    batteryFill.style.background = 'linear-gradient(90deg, #30d158, #32d74b)'; // Green
    batteryPercentText.style.color = '#30d158'; // Green text
  } else if (percent >= 50) {
    batteryFill.style.background = 'linear-gradient(90deg, #32d74b, #ffcc02)'; // Light green to yellow
    batteryPercentText.style.color = '#32d74b'; // Light green text
  } else if (percent >= 20) {
    batteryFill.style.background = 'linear-gradient(90deg, #ffcc02, #ff9500)'; // Yellow to orange
    batteryPercentText.style.color = '#ffcc02'; // Yellow text
  } else if (percent > 0) {
    batteryFill.style.background = 'linear-gradient(90deg, #ff9500, #ff453a)'; // Orange to red
    batteryPercentText.style.color = '#ff453a'; // Red text
  } else {
    // Default white when no voltage entered
    batteryPercentText.style.color = '#f2f2f7'; // White text
  }
}

// Update tips based on battery state
function updateTips(voltage, percent, vMin, vMax, vNominal) {
  let icon, title, text, type = "info";
  let showTroubleshootButton = false;
  
  // Get current battery config for research-based thresholds
  const config = batteryConfigs[parseInt(batteryType.value)];
  const cells = config.cells;
  
  // Research-based voltage thresholds
  const maxSafeVoltage = cells * 4.2; // 4.2V per cell = 100% safe maximum
  const moderateDangerVoltage = cells * 4.3; // 4.3V per cell = high pressure, gas generation
  const fireRiskVoltage = cells * 4.5; // 4.5V per cell = severe thermal runaway risk
  const minSafeVoltage = cells * 3.0; // 3.0V per cell = safe minimum
  const damageVoltage = cells * 2.5; // 2.5V per cell = damage threshold
  
  if (isNaN(voltage)) {
    icon = "💡";
    title = "Ready to calculate";
    text = "Enter your battery voltage above to get started";
  } else if (voltage <= 0) {
    icon = "🔋";
    title = "BMS Protection or No Connection";
    text = "0V reading could mean BMS has cut off power to protect cells, or there's no connection. Check connections and see troubleshooting guide for recovery methods.";
    type = "warning";
    showTroubleshootButton = true;
  } else if (voltage > 120) {
    icon = "🚨";
    title = "DANGER - Extremely high voltage";
    text = "This voltage is dangerously high and could cause fire or explosion. DO NOT charge. Check for wiring issues or wrong battery type.";
    type = "warning";
  } else if (voltage >= fireRiskVoltage) {
    icon = "🚨";
    title = "EXTREME DANGER - Fire Risk";
    text = `Voltage is ${(voltage/cells).toFixed(2)}V per cell (≥4.5V limit). SEVERE thermal runaway risk! DO NOT charge. Disconnect immediately and move to safe area.`;
    type = "warning";
  } else if (voltage >= moderateDangerVoltage) {
    icon = "🚨";
    title = "DANGER - High Pressure";
    text = `Voltage is ${(voltage/cells).toFixed(2)}V per cell (≥4.3V). Battery under high pressure, gas generation likely. Stop charging immediately.`;
    type = "warning";
  } else if (voltage > maxSafeVoltage) {
    icon = "⚠️";
    title = "OVERCHARGED - Stop charging";
    text = `Voltage is ${(voltage/cells).toFixed(2)}V per cell (>4.2V safe limit). Stop charging immediately to prevent damage.`;
    type = "warning";
  } else if (voltage <= damageVoltage && voltage > 0) {
    icon = "🚨";
    title = "CRITICAL - Severe undercharge";
    text = `Voltage is ${(voltage/cells).toFixed(2)}V per cell (≤${2.5}V damage threshold). Battery may be permanently damaged. Use extreme caution.`;
    type = "warning";
    showTroubleshootButton = true;
  } else if (voltage < minSafeVoltage) {
    icon = "🚨";
    title = "DANGER - Undercharged";
    text = `Voltage is ${(voltage/cells).toFixed(2)}V per cell (<${3.0}V safe minimum). Battery may be damaged if left this low. Charge carefully.`;
    type = "warning";
    showTroubleshootButton = true;
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
  } else if (voltage >= vMax * 0.60) {
    icon = "📉";
    title = "Below half";
    text = "Battery is below half charge. Plan your route accordingly and charge soon.";
    type = "info";
  } else if (voltage >= vMax * 0.40) {
    icon = "🏠";
    title = "Storage range";
    text = "Perfect storage voltage (40-60%)! Ideal for long-term storage to preserve battery health.";
    type = "info";
  } else if (voltage >= vMax * 0.25) {
    icon = "⚠️";
    title = "Low charge";
    text = "Battery getting low. Range will be significantly reduced - consider charging soon.";
    type = "warning";
  } else if (voltage >= vMax * 0.20) {
    icon = "🔋";
    title = "Critical charge";
    text = "Battery critically low. Power cutoff may occur soon - charge as soon as possible.";
    type = "warning";
  } else if (voltage >= vMax * 0.05) {
    icon = "🚨";
    title = "Emergency low";
    text = "Emergency battery level. System shutdown imminent - charge immediately.";
    type = "warning";
  } else if (voltage >= vMax * 0.32) {
    icon = "🚨";
    title = "DANGER - Very low";
    text = "Voltage is dangerously low. Charging may be unsafe. Check each cell individually before attempting to charge.";
    type = "warning";
    showTroubleshootButton = true;
  } else if (voltage >= vMax * 0.25) {
    icon = "🚨";
    title = "DANGER - Severely low";
    text = "Voltage is severely low. Cells may be permanently damaged. Charging could be dangerous - seek professional advice.";
    type = "warning";
    showTroubleshootButton = true;
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
    showTroubleshootButton = true;
  } else if (voltage >= vMin * 0.90) {
    icon = "🚨";
    title = "CRITICAL - Deeply discharged";
    text = "Voltage is critically low. Cells may be permanently damaged. Charging could be unsafe.";
    type = "warning";
    showTroubleshootButton = true;
  } else if (voltage >= vMin * 0.85) {
    icon = "🚨";
    title = "DANGER - Extremely discharged";
    text = "Voltage is extremely low. Charging this battery could be dangerous. Seek professional advice.";
    type = "warning";
    showTroubleshootButton = true;
  } else if (voltage >= vMin * 0.80) {
    icon = "🚨";
    title = "DANGER - Battery may be destroyed";
    text = "Voltage is critically low. Battery may be permanently damaged and unsafe to charge.";
    type = "warning";
    showTroubleshootButton = true;
  } else {
    icon = "🔋";
    title = "Battery Protection Active";
    text = "Voltage is extremely low. This could be BMS protection mode or a severely discharged battery. Check the troubleshooting guide to determine if it's safe to attempt recovery.";
    type = "warning";
    showTroubleshootButton = true;
  }
  
  // Update tip card
  tipIcon.textContent = icon;
  tipTitle.textContent = title;
  tipText.textContent = text;
  
  // Update tip card styling
  tipCard.className = `tip-card ${type}`;
  
  // Add troubleshoot button if needed
  if (showTroubleshootButton) {
    if (!document.getElementById('troubleshootBtn')) {
      const troubleshootBtn = document.createElement('button');
      troubleshootBtn.id = 'troubleshootBtn';
      troubleshootBtn.className = 'troubleshoot-btn';
      troubleshootBtn.innerHTML = '🔧 Jumpstart & BMS Guide';
      troubleshootBtn.onclick = () => {
        const jumpstartGuide = document.getElementById('jumpstart-guide');
        if (jumpstartGuide) {
          jumpstartGuide.scrollIntoView({ behavior: 'smooth' });
          // Open the first details section
          const firstDetails = jumpstartGuide.querySelector('details');
          if (firstDetails) {
            firstDetails.open = true;
          }
        }
      };
      tipCard.appendChild(troubleshootBtn);
    }
  } else {
    const existingBtn = document.getElementById('troubleshootBtn');
    if (existingBtn) {
      existingBtn.remove();
    }
  }
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
  
  // Save last voltage for current battery type
  if (voltageInput.value) {
    const lastVoltages = JSON.parse(localStorage.getItem("batteryLastVoltages") || "{}");
    lastVoltages[batteryType.value] = voltageInput.value;
    localStorage.setItem("batteryLastVoltages", JSON.stringify(lastVoltages));
  }
  
  localStorage.setItem("batteryCalcSettings", JSON.stringify(settings));
}

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem("batteryCalcSettings");
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      
      // Set battery type first, then update the display
      if (settings.batteryType) {
        batteryType.value = settings.batteryType;
      }
      cellMax.value = settings.cellMax || "4.2";
      cellNominal.value = settings.cellNominal || "3.7";
      cellMin.value = settings.cellMin || "3.0";
      controllerCutoff.value = settings.controllerCutoff || "0";
      
      if (settings.isAdvancedOpen) {
        toggleAdvanced();
      }
      
      // Set last voltage as placeholder for this specific battery type
      const lastVoltages = JSON.parse(localStorage.getItem("batteryLastVoltages") || "{}");
      const lastVoltageForType = lastVoltages[settings.batteryType];
      if (lastVoltageForType) {
        voltageInput.placeholder = `e.g. ${lastVoltageForType}V`;
      } else {
        // Show nominal voltage as default
        const config = batteryConfigs[parseInt(settings.batteryType)];
        voltageInput.placeholder = `e.g. ${config.nominal}V`;
      }
      
      // Update the battery display after loading settings
      updateBattery();
    } catch (e) {
      // Could not load saved settings
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

// Camera OCR functionality
let cameraStream = null;
let autoScanInterval = null;
let lastDetectedVoltage = null;

async function openCamera() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraVideo');
  const result = document.getElementById('scanResult');
  
  try {
    // Request camera access
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'environment', // Use back camera if available
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    
    video.srcObject = cameraStream;
    modal.classList.add('active');
    result.innerHTML = '🔍 Looking for voltage display...';
    result.className = 'scan-result';
    
    // Start auto-scanning after camera loads
    video.onloadedmetadata = () => {
      startAutoCapture();
    };
    
  } catch (error) {
    alert('Camera access denied or not available. Please allow camera access and try again.');
  }
}

function closeCamera() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraVideo');
  
  // Stop auto-scanning
  stopAutoCapture();
  
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  
  video.srcObject = null;
  modal.classList.remove('active');
}

function startAutoCapture() {
  const result = document.getElementById('scanResult');
  result.innerHTML = '🔍 Auto-scanning for voltage...';
  result.className = 'scan-result';
  
  // Scan every 2 seconds
  autoScanInterval = setInterval(async () => {
    await performAutoScan();
  }, 2000);
}

function stopAutoCapture() {
  if (autoScanInterval) {
    clearInterval(autoScanInterval);
    autoScanInterval = null;
  }
  lastDetectedVoltage = null;
}

async function performAutoScan() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('captureCanvas');
  const result = document.getElementById('scanResult');
  
  if (!video.videoWidth || !video.videoHeight) return;
  
  try {
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Capture current frame
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert to data URL for OCR
    const imageData = canvas.toDataURL('image/jpeg', 0.6);
    
    // Quick OCR check - get all possible voltages
    const detectionResult = await performQuickOCR(imageData);
    
    if (detectionResult.bestVoltage) {
      const voltage = detectionResult.bestVoltage;
      const allVoltages = detectionResult.allVoltages;
      
      // Store the detected voltage for the save button
      window.detectedVoltage = voltage;
      lastDetectedVoltage = voltage;
      
      // Show what we detected
      let displayText = `🎯 Detected: ${voltage}V`;
      if (allVoltages.length > 1) {
        displayText += ` (from ${allVoltages.join('V, ')}V)`;
      }
      displayText += ` - Click "Save Voltage" to use`;
      
      result.innerHTML = displayText;
      result.className = 'scan-result success';
      
    } else if (detectionResult.allVoltages.length > 0) {
      // Found numbers but none look like battery voltages
      result.innerHTML = `🔍 Found numbers: ${detectionResult.allVoltages.join(', ')} - None look like battery voltages`;
      result.className = 'scan-result';
      window.detectedVoltage = null;
      
    } else {
      // No numbers detected at all
      result.innerHTML = '🔍 Auto-scanning... Position multimeter display clearly in view';
      result.className = 'scan-result';
      window.detectedVoltage = null;
    }
    
  } catch (error) {
    result.innerHTML = '🔍 Auto-scanning... (processing)';
    result.className = 'scan-result';
  }
}

async function performQuickOCR(imageData) {
  try {
    const response = await fetch(imageData);
    const blob = await response.blob();
    
    const formData = new FormData();
    formData.append('file', blob, 'image.jpg');
    formData.append('apikey', 'helloworld');
    formData.append('OCREngine', '1'); // Faster engine for live detection
    formData.append('scale', 'true');
    
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });
    
    const ocrData = await ocrResponse.json();
    
    if (ocrData.OCRExitCode === 1 && ocrData.ParsedResults?.[0]?.ParsedText) {
      const text = ocrData.ParsedResults[0].ParsedText;
      return extractAllVoltagesFromText(text);
    }
    
    return { bestVoltage: null, allVoltages: [] };
    
  } catch (error) {
    return { bestVoltage: null, allVoltages: [] };
  }
}

async function captureAndAnalyze() {
  const result = document.getElementById('scanResult');
  
  // Check if we have an auto-detected voltage
  if (window.detectedVoltage) {
    // Use the auto-detected voltage
    voltageInput.value = window.detectedVoltage;
    updateBattery();
    result.innerHTML = `✅ Saved voltage: ${window.detectedVoltage}V`;
    result.className = 'scan-result success';
    
    // Close camera after short delay
    setTimeout(() => {
      closeCamera();
    }, 1000);
    
  } else {
    // No auto-detected voltage, try manual OCR
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('captureCanvas');
    
    try {
      // Set canvas size to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Capture the current frame
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      result.innerHTML = 'Analyzing image with OCR...';
      result.className = 'scan-result';
      
      // Convert canvas to data URL and send to OCR API
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      // Try OCR.Space API with better settings
      const ocrResult = await performOCR(imageData);
      
      if (ocrResult) {
        // Success - set the voltage and close camera
        voltageInput.value = ocrResult;
        updateBattery();
        result.innerHTML = `✅ Found voltage: ${ocrResult}V`;
        result.className = 'scan-result success';
        
        // Close camera after short delay
        setTimeout(() => {
          closeCamera();
        }, 1500);
        
      } else {
        // Show manual fallback
        showManualInput(result);
      }
      
    } catch (error) {
      // Show manual fallback on error
      showManualInput(result);
    }
  }
}

function showManualInput(result) {
  result.innerHTML = `
    <div style="text-align: center;">
      <p>🤖 OCR couldn't read the display</p>
      <p>Enter the voltage you see:</p>
      <input type="number" id="manualVoltageInput" step="0.1" style="
        padding: 0.5rem; 
        border: 2px solid #667eea; 
        border-radius: 8px; 
        font-size: 1rem; 
        width: 120px; 
        background: #1a202c; 
        color: #e2e8f0;
        text-align: center;
        margin: 0.5rem;
      " placeholder="78.5" autofocus>
      <button onclick="setManualVoltage()" style="
        padding: 0.5rem 1rem; 
        background: #48bb78; 
        color: white; 
        border: none; 
        border-radius: 8px; 
        cursor: pointer; 
        margin-left: 0.5rem;
        font-weight: 600;
      ">Set Voltage</button>
    </div>
  `;
  result.className = 'scan-result';
}

async function performOCR(imageData) {
  try {
    // Convert data URL to blob
    const response = await fetch(imageData);
    const blob = await response.blob();
    
    // Create form data for OCR.Space API
    const formData = new FormData();
    formData.append('file', blob, 'image.jpg');
    formData.append('apikey', 'helloworld'); // Free tier API key
    formData.append('OCREngine', '2');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    
    // Call OCR.Space API
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });
    
    const ocrData = await ocrResponse.json();
    
    if (ocrData.OCRExitCode === 1 && ocrData.ParsedResults?.[0]?.ParsedText) {
      const text = ocrData.ParsedResults[0].ParsedText;
      return extractVoltageFromText(text);
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

function setManualVoltage() {
  const manualInput = document.getElementById('manualVoltageInput');
  const voltage = parseFloat(manualInput.value);
  const result = document.getElementById('scanResult');
  
  if (voltage && voltage > 0) {
    // Success - set the voltage and close camera
    voltageInput.value = voltage;
    updateBattery();
    result.innerHTML = `✅ Voltage set: ${voltage}V`;
    result.className = 'scan-result success';
    
    // Close camera after short delay
    setTimeout(() => {
      closeCamera();
    }, 1000);
    
  } else {
    result.innerHTML = '❌ Please enter a valid voltage value.';
    result.className = 'scan-result error';
  }
}

function extractAllVoltagesFromText(text) {
  if (!text || typeof text !== 'string') {
    return { bestVoltage: null, allVoltages: [] };
  }
  
  // Remove all non-numeric characters except dots and spaces
  const cleanText = text.replace(/[^\d\.\s]/g, ' ').trim();
  
  // Look for valid voltage patterns - be very specific
  const voltagePatterns = [
    /\b(\d{1,2}\.\d{1,3})\b/g,    // 1-2 digits, dot, 1-3 decimals (e.g., 78.5, 4.25)
    /\b(\d{2,3})\b/g              // 2-3 digit whole numbers (e.g., 78, 84)
  ];
  
  const allNumbers = [];
  const validVoltages = [];
  
  for (const pattern of voltagePatterns) {
    let match;
    while ((match = pattern.exec(cleanText)) !== null) {
      const number = parseFloat(match[1]);
      allNumbers.push(number);
      
      // Check if it's a valid voltage
      if (isValidVoltage(number)) {
        validVoltages.push(number);
      }
    }
  }
  
  // Remove duplicates
  const uniqueNumbers = [...new Set(allNumbers)].sort((a, b) => a - b);
  const uniqueValidVoltages = [...new Set(validVoltages)].sort((a, b) => a - b);
  
  let bestVoltage = null;
  
  if (uniqueValidVoltages.length > 0) {
    // Prioritize battery-specific voltage ranges
    const batteryPackVoltages = uniqueValidVoltages.filter(v => v >= 30 && v <= 90);
    const singleCellVoltages = uniqueValidVoltages.filter(v => v >= 3.0 && v <= 4.5);
    const otherValidVoltages = uniqueValidVoltages.filter(v => 
      (v < 3.0 || v > 4.5) && (v < 30 || v > 90)
    );
    
    // Select the best voltage based on current battery type context
    const currentBatteryType = parseInt(document.getElementById('batteryType').value);
    const currentBatteryRange = getBatteryVoltageRange(currentBatteryType);
    
    // Find voltages that match the current battery type
    const contextMatchingVoltages = uniqueValidVoltages.filter(v => 
      v >= currentBatteryRange.min && v <= currentBatteryRange.max
    );
    
    if (contextMatchingVoltages.length > 0) {
      // Use voltage that matches current battery type
      bestVoltage = contextMatchingVoltages[0];
    } else if (batteryPackVoltages.length > 0) {
      // Prefer battery pack voltages
      bestVoltage = batteryPackVoltages[0];
    } else if (singleCellVoltages.length > 0) {
      // Then single cell voltages
      bestVoltage = singleCellVoltages[0];
    } else {
      // Finally any other valid voltage
      bestVoltage = uniqueValidVoltages[0];
    }
  }
  
  return {
    bestVoltage: bestVoltage,
    allVoltages: uniqueNumbers
  };
}

function getBatteryVoltageRange(batteryType) {
  const config = batteryConfigs[batteryType];
  if (!config) return { min: 10, max: 100 };
  
  // Calculate expected voltage range for this battery type
  const cells = config.cells;
  const minVoltage = cells * 3.0;  // 3.0V per cell minimum
  const maxVoltage = cells * 4.2;  // 4.2V per cell maximum
  
  return { min: minVoltage, max: maxVoltage };
}

function extractVoltageFromText(text) {
  const result = extractAllVoltagesFromText(text);
  return result.bestVoltage;
}

function isValidVoltage(voltage) {
  // Must be a valid number
  if (!voltage || isNaN(voltage) || !isFinite(voltage)) {
    return false;
  }
  
  // Must be positive
  if (voltage <= 0) {
    return false;
  }
  
  // Must be in reasonable voltage ranges for batteries
  const isInValidRange = 
    (voltage >= 1.0 && voltage <= 5.0) ||    // Single cell range (1.0V - 5.0V)
    (voltage >= 10.0 && voltage <= 100.0);   // Battery pack range (10V - 100V)
  
  if (!isInValidRange) {
    return false;
  }
  
  // Reject obvious non-voltage numbers
  const invalidPatterns = [
    voltage.toString().length > 5,           // Too many digits
    voltage === Math.floor(voltage) && voltage < 10, // Single digit whole numbers
    voltage > 99.999                         // Unrealistically high
  ];
  
  if (invalidPatterns.some(invalid => invalid)) {
    return false;
  }
  
  return true;
}

// Helper function to detect valid battery voltages for current battery type
function isValidBatteryVoltage(voltage) {
  if (isNaN(voltage) || voltage <= 0) return false;
  
  // Get current battery type range
  const currentBatteryType = parseInt(document.getElementById('batteryType').value);
  const config = batteryConfigs[currentBatteryType];
  if (!config) return false;
  
  const cells = config.cells;
  // Use lenient ranges for live validation (wider than safety thresholds)
  const minVoltage = cells * 2.0;  // Very damaged but still a valid reading
  const maxVoltage = cells * 4.5;  // Extremely overcharged but still a valid reading
  
  return voltage >= minVoltage && voltage <= maxVoltage;
}

// Setup editable voltage display functionality
function setupEditableVoltageDisplay() {
  const editableDisplay = document.querySelector('.voltage-value-editable');
  let isEditing = false;
  
  // Handle focus - start editing mode
  editableDisplay.addEventListener('focus', function() {
    isEditing = true;
    const voltage = parseFloat(voltageInput.value);
    if (!isNaN(voltage)) {
      // Show just the number when editing
      this.textContent = voltage.toString();
    } else {
      this.textContent = '';
    }
  });
  
  // Handle input events - live update when valid voltage for current battery type
  editableDisplay.addEventListener('input', function() {
    if (!isEditing) return;
    
    const text = this.textContent.trim();
    // Extract numbers from the text
    const numberMatch = text.match(/^[\d\.]*$/);
    if (numberMatch && text !== '') {
      const voltage = parseFloat(text);
      if (!isNaN(voltage)) {
        voltageInput.value = voltage;
        
        // Live update if it's a valid voltage for current battery type
        if (isValidBatteryVoltage(voltage)) {
          updateBattery(); // Update live!
        }
      }
    } else if (text === '') {
      voltageInput.value = '';
    }
  });
  
  // Handle paste events
  editableDisplay.addEventListener('paste', function(e) {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text');
    const numberMatch = paste.match(/[\d\.]+/);
    if (numberMatch) {
      const voltage = parseFloat(numberMatch[0]);
      if (!isNaN(voltage)) {
        this.textContent = voltage.toString();
        voltageInput.value = voltage;
      }
    }
  });
  
  // Handle key events
  editableDisplay.addEventListener('keydown', function(e) {
    // Allow: backspace, delete, tab, escape, enter, period, and numbers
    if ([46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Allow numbers 0-9
        (e.keyCode >= 48 && e.keyCode <= 57) ||
        // Allow numpad numbers 0-9
        (e.keyCode >= 96 && e.keyCode <= 105)) {
      return;
    }
    // Prevent other keys
    e.preventDefault();
  });
  
  // Handle enter key to finish editing
  editableDisplay.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.blur();
    }
  });
  
  // Format on blur - stop editing mode
  editableDisplay.addEventListener('blur', function() {
    isEditing = false;
    const voltage = parseFloat(voltageInput.value);
    if (!isNaN(voltage)) {
      // Format with proper precision
      const originalValue = voltageInput.value;
      if (originalValue && originalValue.includes('.')) {
        const decimalPlaces = Math.min(3, originalValue.split('.')[1].length);
        this.textContent = `${voltage.toFixed(decimalPlaces)}V`;
      } else {
        this.textContent = `${voltage.toFixed(1)}V`;
      }
      // Now update battery after editing is done
      updateBattery();
    } else {
      this.textContent = '-- V';
      updateBattery();
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", init);

// Simplified camera feature - manual entry after photo capture
