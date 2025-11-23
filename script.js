gsap.registerPlugin(ScrollTrigger);

const features = [
  { id: "tempo", label: "Tempo", min: 60, max: 200, step: 1, value: 120 },
  { id: "danceability", label: "Danceability", min: 0, max: 1, step: 0.01, value: 0.5 },
  { id: "energy", label: "Energy", min: 0, max: 1, step: 0.01, value: 0.5 },
  { id: "valence", label: "Valence", min: 0, max: 1, step: 0.01, value: 0.5 },
  { id: "instrumentalness", label: "Instrumentalness", min: 0, max: 1, step: 0.01, value: 0.0 },
  { id: "acousticness", label: "Acousticness", min: 0, max: 1, step: 0.01, value: 0.3 },
  { id: "loudness", label: "Loudness", min: -20, max: 0, step: 0.1, value: -6 }
];

function createSliders() {
  const container = document.getElementById("sliders-container");

  features.forEach(f => {
    const wrapper = document.createElement("div");
    wrapper.className = "slider-wrapper";

    wrapper.innerHTML = `
      <label>${f.label}</label>
      <input 
        type="range" 
        id="slider-${f.id}"
        min="${f.min}" 
        max="${f.max}" 
        step="${f.step}"
        value="${f.value}"
      />
      <canvas class="histogram" id="hist-${f.id}"></canvas>
    `;

    container.appendChild(wrapper);
  });
}


function enableScrollSections() {
  gsap.utils.toArray(".scroll-section").forEach((section) => {
    gsap.fromTo(
      section,
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        scrollTrigger: {
          trigger: section,
          start: "top 70%",
          end: "bottom 60%",
          toggleActions: "play none none reverse",
        }
      }
    );
  });
}

document.getElementById("createSongBtn").addEventListener("click", () => {
  const results = document.getElementById("results");
  results.classList.remove("hidden");

  gsap.to(results, { opacity: 1, duration: 0.6 });

  enableScrollSections();
});

createSliders();