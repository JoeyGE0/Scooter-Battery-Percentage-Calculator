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
  batteryType.addEventListener("change", () => {
    // Clear current voltage when switching battery types
    voltageInput.value = "";
    updateBattery();
    updateVoltagePlaceholder();
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
  // Check for dangerously low voltage (same thresholds as the tips)
  const isDangerouslyLow = voltage < vMin * 0.90 || voltage < vMax * 0.25;
  
  if (isDangerouslyLow) {
    // Red outline with pulsing for dangerous undercharge
    voltageInput.style.borderColor = "#f56565";
    voltageInput.style.boxShadow = "0 0 0 4px rgba(245, 101, 101, 0.3), 0 0 20px rgba(245, 101, 101, 0.5)";
    voltageInput.style.animation = "dangerPulse 1s infinite";
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
  
  // Update voltage display
  if (!isNaN(voltage)) {
    voltageDisplay.textContent = `${voltage.toFixed(1)}V`;
  } else {
    voltageDisplay.textContent = "-- V";
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
      // More accurate lithium battery percentage calculation
      // Uses a curve that better matches real lithium battery behavior
      const voltageRange = vMax - vMin;
      const voltageRatio = (voltage - vMin) / voltageRange;
      
      // Apply curve correction for lithium batteries
      // Higher voltages (above 3.7V/cell) have steeper drops
      // Lower voltages (below 3.7V/cell) have more gradual drops
      let correctedRatio;
      if (voltageRatio > 0.5) {
        // Above 50% - steeper curve
        correctedRatio = 0.5 + (voltageRatio - 0.5) * 1.2;
      } else {
        // Below 50% - more gradual curve
        correctedRatio = voltageRatio * 0.8;
      }
      
      percent = Math.min(Math.max(correctedRatio * 100, 0), 100);
      status = getStatusText(percent, voltage, vNominal);
    }
  }
  
  // Update battery visual
  batteryFill.style.width = `${percent}%`;
  batteryPercentText.textContent = `${Math.round(percent)}%`;
  statusText.textContent = status;
  
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
  
  batteryFill.style.background = `linear-gradient(90deg, hsl(${hue}, ${saturation}%, ${lightness}%), hsl(${hue + 20}, ${saturation}%, ${lightness + 5}%))`;
}

// Update tips based on battery state
function updateTips(voltage, percent, vMin, vMax, vNominal) {
  let icon, title, text, type = "info";
  let showTroubleshootButton = false;
  
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
    result.innerHTML = '';
    result.className = 'scan-result';
    
  } catch (error) {
    alert('Camera access denied or not available. Please allow camera access and try again.');
  }
}

function closeCamera() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraVideo');
  
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  
  video.srcObject = null;
  modal.classList.remove('active');
}

async function captureAndAnalyze() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('captureCanvas');
  const result = document.getElementById('scanResult');
  
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
    
    // Try OCR.Space API (free tier)
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

function extractVoltageFromText(text) {
  if (!text || typeof text !== 'string') return null;
  
  // Remove all non-numeric characters except dots and spaces
  const cleanText = text.replace(/[^\d\.\s]/g, ' ').trim();
  
  // Look for valid voltage patterns - be very specific
  const voltagePatterns = [
    /\b(\d{1,2}\.\d{1,3})\b/g,    // 1-2 digits, dot, 1-3 decimals (e.g., 78.5, 4.25)
    /\b(\d{2,3})\b/g              // 2-3 digit whole numbers (e.g., 78, 84)
  ];
  
  const potentialVoltages = [];
  
  for (const pattern of voltagePatterns) {
    let match;
    while ((match = pattern.exec(cleanText)) !== null) {
      const voltage = parseFloat(match[1]);
      
      // Additional validation
      if (isValidVoltage(voltage)) {
        potentialVoltages.push(voltage);
      }
    }
  }
  
  if (potentialVoltages.length > 0) {
    // Remove duplicates and sort
    const uniqueVoltages = [...new Set(potentialVoltages)].sort((a, b) => a - b);
    
    // Return the most likely voltage
    if (uniqueVoltages.length === 1) {
      return uniqueVoltages[0];
    } else {
      // If multiple voltages, prefer ones in typical battery ranges
      const preferredVoltages = uniqueVoltages.filter(v => 
        (v >= 30 && v <= 90) || // Typical battery pack voltages
        (v >= 3.0 && v <= 4.5)  // Single cell voltages
      );
      
      if (preferredVoltages.length > 0) {
        return preferredVoltages[Math.floor(preferredVoltages.length / 2)];
      } else {
        return uniqueVoltages[Math.floor(uniqueVoltages.length / 2)];
      }
    }
  }
  
  return null;
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

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", init);

// Simplified camera feature - manual entry after photo capture
