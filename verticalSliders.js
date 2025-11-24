// verticalSliders.js
export const features = [
  { id: "tempo", label: "Tempo (BPM)", min: 60, max: 200, step: 1, value: 120 },
  { id: "danceability", label: "Danceability", min: 0, max: 1, step: 0.01, value: 0.5 },
  { id: "energy", label: "Energy", min: 0, max: 1, step: 0.01, value: 0.6 },
  { id: "valence", label: "Valence", min: 0, max: 1, step: 0.01, value: 0.5 },
  { id: "instrumentalness", label: "Instrumentalness", min: 0, max: 1, step: 0.01, value: 0.0 },
  { id: "acousticness", label: "Acousticness", min: 0, max: 1, step: 0.01, value: 0.3 },
  { id: "loudness", label: "Loudness (dB)", min: -20, max: 0, step: 0.1, value: -6 },
];

export const userValues = {};
features.forEach(f => userValues[f.id] = f.value);

function formatValue(val, feature) {
  if (feature.step >= 1) {
    return Math.round(val).toString(); 
  } else if (feature.step >= 0.1) {
    return val.toFixed(1);  
  } else {
    return val.toFixed(2); 
  }
}

export function createVerticalSliders() {
  const container = document.getElementById("sliders-container");

  features.forEach(f => {
    const wrapper = document.createElement("div");
    wrapper.className = "slider-wrapper";

    wrapper.innerHTML = `
      <div class="slider-label">${f.label}</div>

      <div class="v-slider" id="v-${f.id}">
        <div class="v-track"></div>
        <div class="v-thumb metallicss" id="thumb-${f.id}"></div>
      </div>

      <div class="slider-value" id="val-${f.id}">${formatValue(f.value, f)}</div>

    `;

    container.appendChild(wrapper);

    initSlider(f);
  });
}

function initSlider(feature) {
  const slider = document.getElementById(`v-${feature.id}`);
  const thumb = document.getElementById(`thumb-${feature.id}`);
  const valueBox = document.getElementById(`val-${feature.id}`);
  let dragging = false;
  const sliderHeight = () => slider.getBoundingClientRect().height;

  function valueToY(val) {
    const pct = (val - feature.min) / (feature.max - feature.min);
    return sliderHeight() * (1 - pct);
  }

  function yToValue(y) {
    const pct = 1 - (y / sliderHeight());
    let scaled = feature.min + pct * (feature.max - feature.min);
    scaled = Math.round(scaled / feature.step) * feature.step;
    return Math.min(feature.max, Math.max(feature.min, scaled));
  }

  function updateThumbPosition(val) {
    const y = valueToY(val);
    thumb.style.top = `${y - thumb.offsetHeight / 2}px`;
  }

  updateThumbPosition(feature.value);

  function startDrag(e) {
    dragging = true;
    document.body.style.userSelect = "none";
    updateDrag(e);
  }

  function stopDrag() {
    dragging = false;
    document.body.style.userSelect = "auto";
  }

  function updateDrag(e) {
    if (!dragging) return;
    const rect = slider.getBoundingClientRect();
    let y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    y = Math.max(0, Math.min(sliderHeight(), y));
    const newVal = yToValue(y);
    updateThumbPosition(newVal);
    valueBox.textContent = formatValue(newVal, feature);
    userValues[feature.id] = newVal;
  }

  thumb.addEventListener("mousedown", startDrag);
  thumb.addEventListener("touchstart", startDrag);
  document.addEventListener("mousemove", updateDrag);
  document.addEventListener("touchmove", updateDrag);
  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("touchend", stopDrag);
}


export function setPresetValues(preset) {
  features.forEach(feature => {
    const value = preset[feature.id];
    if (value == null) return;  

    userValues[feature.id] = value;

    const slider   = document.getElementById(`v-${feature.id}`);
    const thumb    = document.getElementById(`thumb-${feature.id}`);
    const valueBox = document.getElementById(`val-${feature.id}`);

    if (!slider || !thumb || !valueBox) return;

    const sliderHeight = slider.getBoundingClientRect().height;

    const pct = (value - feature.min) / (feature.max - feature.min);
    const y   = sliderHeight * (1 - pct);

    thumb.style.top = `${y - thumb.offsetHeight / 2}px`;
    valueBox.textContent = formatValue(value, feature);
  });
}
