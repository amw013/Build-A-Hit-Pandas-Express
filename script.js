import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { createVerticalSliders, userValues, setPresetValues, features} from './verticalSliders.js';
gsap.registerPlugin(ScrollTrigger);


console.log("script.js loaded");

let histogramMode = "all";  
let radarChart = null;
let similarRadarChart = null;

let featureImportanceChart = null;  

function setupProgressDots() {
  const dots = Array.from(document.querySelectorAll(".progress-dot"));
  if (!dots.length) return;

  // Map sectionId -> {sectionEl, dotEl}
  const sectionMap = {};
  dots.forEach(dot => {
    const sectionId = dot.dataset.sectionId;
    const sectionEl = document.getElementById(sectionId);
    if (sectionEl) {
      sectionMap[sectionId] = { section: sectionEl, dot };
    }
  });

  // Click = scroll to that section
  dots.forEach(dot => {
    dot.addEventListener("click", () => {
      const sectionId = dot.dataset.sectionId;
      const entry = sectionMap[sectionId];
      if (entry && entry.section) {
        entry.section.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });

  // Helper to update .active dot
  function setActiveDot(sectionId) {
    dots.forEach(dot => {
      dot.classList.toggle("active", dot.dataset.sectionId === sectionId);
    });
  }

  // Observe which section is in view
  const observer = new IntersectionObserver(
    (entries) => {
      // Find the entry whose center is most visible
      let best = null;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        if (!best || entry.intersectionRatio > best.intersectionRatio) {
          best = entry;
        }
      });

      if (best && best.target.id) {
        setActiveDot(best.target.id);
      }
    },
    {
      threshold: [0.3, 0.6], // triggers when ~1/3–2/3 of it is in view
    }
  );

  // Attach observer to each section we care about
  Object.values(sectionMap).forEach(({ section }) => observer.observe(section));
}

// Call this when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  setupProgressDots();
});



function initFeatureImportanceChart() {
  const canvasEl = document.getElementById("featureImportanceChart");
  if (!canvasEl || typeof Chart === "undefined") return;

  // Numbers derived from the simple model,
  const coeffs = {
    danceability:  1.659327,
    energy:       -4.149053,
    valence:      -0.227540,
    acousticness:  0.620608,
    instrumentalness: -2.400515,
    speechiness:  0.410292,
    tempo:        0.118565,   // relative to average tempo
    loudness:     0.901055    // relative to average loudness
  };

  const labels = [
    "Danceability",
    "Energy",
    "Valence",
    "Acousticness",
    "Instrumentalness",
    "Speechiness",
    "Tempo (relative)",
    "Loudness (relative)"
  ];

  const rawKeys = [
    "danceability",
    "energy",
    "valence",
    "acousticness",
    "instrumentalness",
    "speechiness",
    "tempo",
    "loudness"
  ];

  const dataVals = rawKeys.map(k => coeffs[k]);

  const bgColors = dataVals.map(v =>
    v >= 0 ? "rgba(0, 200, 255, 0.4)" : "rgba(255, 99, 132, 0.4)"
  );
  const borderColors = dataVals.map(v =>
    v >= 0 ? "rgba(0, 200, 255, 1)" : "rgba(255, 99, 132, 1)"
  );

  // Destroy any previous instance
  if (featureImportanceChart) {
    featureImportanceChart.destroy();
  }

  featureImportanceChart = new Chart(canvasEl, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Tendency toward more popular songs (dataset pattern)",
        data: dataVals,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1.5
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      scales: {
        x: {
          grid: { color: "#333" },
          ticks: {
            color: "#f9fafb",
            callback: (val) => val
          },
          title: {
            display: true,
            text: "Leans toward ← less popular · more popular → (in this dataset)",
            color: "#f9fafb",
            font: { size: 11 }
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: "#f9fafb" }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || "";
              const value = ctx.parsed.x;
              const morePopular = value >= 0;

              const directionText = morePopular
                ? "shows up more often in popular songs in this dataset."
                : "is more common in the less-popular songs here.";

              const explanations = {
                "Danceability":
                  "More danceable tracks tend to be over-represented among the popular songs.",
                "Energy":
                  "Extremely high-energy tracks tilt a bit more toward the less-popular side in this snapshot.",
                "Valence":
                  "Happier-sounding songs (high valence) are slightly less typical among the biggest tracks here.",
                "Acousticness":
                  "Songs with more acoustic texture show up a bit more often among popular tracks.",
                "Instrumentalness":
                  "Highly instrumental tracks are more common on the less-popular side.",
                "Speechiness":
                  "Tracks with more spoken-word / rap-like qualities appear more in popular songs.",
                "Tempo (relative)":
                  "Being a bit faster than average is more often a trait of popular songs.",
                "Loudness (relative)":
                  "Louder masters tend to be more represented among popular tracks in this dataset."
              };

              const prettyVal = value.toFixed(3);
              const expl = explanations[label] || "";

              return [
                `${label}: ${prettyVal}`,
                `${label} ${directionText}`,
                expl
              ];
            }
          }
        }
      }
    }
  });
}






function logistic(score) {
  return 1 / (1 + Math.exp(-score));
}

function normalizeFeature(value, min, max) {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}




function computeHitProbability(values) {
  const dance       = values.danceability;
  const energy      = values.energy;
  const valence     = values.valence;
  const acoustic    = values.acousticness;
  const instr       = values.instrumentalness;

  const speech      = values.speechiness;
  const tempo       = values.tempo;
  const loudness    = values.loudness;
  const TEMPO_MEAN = 121.052733;
  const TEMPO_STD  = 26.831144;
  const LOUD_MEAN  = -6.828521;
  const LOUD_STD   = 3.017736;
  const tempoStd = (tempo    - TEMPO_MEAN) / TEMPO_STD;
  const loudStd  = (loudness - LOUD_MEAN)  / LOUD_STD;

  let s = -2.474343586054981; 

  s += 1.659327  * dance;
  s += -4.149053 * energy;
  s += -0.227540 * valence;
  s += 0.620608  * acoustic;
  s += -2.400515 * instr;
  s += 0.410292  * speech;
  s += 0.118565  * tempoStd;
  s += 0.901055  * loudStd;

  return logistic(s); 
}


function fireConfetti() {
  if (typeof confetti !== "function") return; 

  const duration = 1500; 
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 }
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 }
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}


function describeProbability(p) {
  const isRealHit =
    currentSong && currentSong.track_popularity != null &&
    currentSong.track_popularity >= 80;

  if (isRealHit) {
    return "This already a hit, the model is just trying to reverse-engineer why it works";
  }

  if (p < 0.02) {
    return "Taste is subjective...";
  } else if (p < 0.04) {
    return "It's got potential!";
  } else if (p < 0.07) {
    return "This is it.";
  } else {
    return "Next Song of the Summer!";
  }
}

function closingSummary(p) {
  const isRealHit =
    currentSong && currentSong.track_popularity != null &&
    currentSong.track_popularity >= 80;

  if (isRealHit) {
    return "This track is actually a banger but the model under-rates it, that just shows how much things like marketing, fandom, and vibes matter beyond audio features";
  }

  if (p < 0.02) {
    return "Missed the mark...";
  } else if (p < 0.04) {
    return "Let's Try Something Else...";
  } else if (p < 0.07) {
    return "So close to charting!";
  } else {
    return "We've got ourselves a hit!";
  }
}


function renderPredictedResult(prob) {
  const predicted = document.getElementById("predictedResult");
  const percent = Math.round(prob * 100);

  let popularityLine = "";
  if (currentSong && currentSong.track_popularity != null) {
    const popVal = currentSong.track_popularity;
    popularityLine = `
      <div class="predicted-actual">
        Actual Spotify popularity: 
        <span class="predicted-actual-number">${popVal}</span>
      </div>
    `;
  }

  predicted.innerHTML = `
    <div class="predicted-box">
      <div class="predicted-main">
        <div class="predicted-number">${percent}%</div>
        <div class="predicted-label">estimated hit chance</div>
      </div>
      <div class="predicted-bar-bg">
        <div class="predicted-bar-fill" style="width: ${percent}%;"></div>
      </div>
      ${popularityLine}
      <p class="predicted-text">${describeProbability(prob)}</p>
    </div>
  `;

  const closing = document.getElementById("closingMessage");
  closing.textContent = closingSummary(prob);
}


const featureDisplayOrder = [
  { id: "tempo",           label: "Tempo (BPM)" },
  { id: "danceability",    label: "Danceability" },
  { id: "energy",          label: "Energy" },
  { id: "valence",         label: "Valence" },
  { id: "instrumentalness",label: "Instrumentalness" },
  { id: "speechiness",     label: "Speechiness" },
  { id: "acousticness",    label: "Acousticness" },
  { id: "loudness",        label: "Loudness (dB)" },
];

function normalizeForBars(values) {
  const tempoMin = 60;
  const tempoMax = 200;

  const loudMin = -20;
  const loudMax = 0;

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  return {
    tempo: clamp01((values.tempo - tempoMin) / (tempoMax - tempoMin)),
    danceability: clamp01(values.danceability),
    energy: clamp01(values.energy),
    valence: clamp01(values.valence),
    instrumentalness: clamp01(values.instrumentalness),
    speechiness: clamp01(values.speechiness),
    acousticness: clamp01(values.acousticness),
    loudness: clamp01((values.loudness - loudMin) / (loudMax - loudMin)),
  };
}

function formatFeatureDisplay(id, value) {
  if (value == null || isNaN(value)) return "";

  if (id === "tempo") {
    return Math.round(value).toString(); 
  } else if (id === "loudness") {
    return value.toFixed(1);    
  } else {
    return value.toFixed(2);  
  }
}

function renderComparisonViz(values) {
  const container = document.getElementById("comparisonViz");
  const norm = normalizeForBars(values);

  container.innerHTML = "";

  featureDisplayOrder.forEach(f => {
    const rawVal = values[f.id];
    const w = (norm[f.id] || 0) * 100;
    const displayVal = formatFeatureDisplay(f.id, rawVal);

    const row = document.createElement("div");
    row.className = "feature-row";

    row.innerHTML = `
      <div class="feature-row-main">
        <div class="feature-name">${f.label}</div>
        <div class="feature-bar-bg">
          <div class="feature-bar-fill" style="width: ${w}%;"></div>
        </div>
        <div class="feature-value">${displayVal}</div>
      </div>
      <!-- per-feature histogram goes here -->
      <div class="feature-hist"></div>
    `;

    container.appendChild(row);

    // draw histogram under this row
    const histEl = row.querySelector(".feature-hist");
    renderFeatureHistogramForFeature(f.id, rawVal, histEl);

    
  });
}
//  similar songs 

let songs = [];
let currentSong = null;

// global tooltip for histograms
const histTooltip = d3.select("body")
  .append("div")
  .attr("class", "hist-tooltip")
  .style("position", "fixed")
  .style("pointer-events", "none")
  .style("background", "#111")
  .style("color", "#fff")
  .style("padding", "6px 8px")
  .style("border-radius", "4px")
  .style("font-size", "11px")
  .style("opacity", 0)
  .style("z-index", 1000);

let songsPromise = d3.json("data/spotify_web_subset.json").then(data => {
  songs = data;
  console.log("Loaded songs:", songs.length);
  console.log("First song example:", songs[0]);
  return songs;
}).catch(err => {
  console.error("Failed to load songs JSON:", err);
  songs = [];
  return songs;
});



// fetch("data/spotify_songs_clean.csv")
//   .then(response => response.text())
//   .then(csvText => {
//     spotifyData = Papa.parse(csvText, {
//       header: true,       // first row is column names
//       skipEmptyLines: true
//     }).data;



//     // Example: build a lookup table for genres
//     const genreLookup = new Map();
//     spotifyData.forEach(d => {
//       if (d.track_name && d.playlist_genre) {
//         genreLookup.set(d.track_name, d.playlist_genre);
//       }
//     });

//     songs = songs.map(s => {
//       const genre = s.track_name ? genreLookup.get(s.track_name) : undefined;
//       if (!genre) {
//         console.log("No genre found for:", s.track_name);
//       }
//       return {
//         ...s,
//         playlist_genre: genre ?? "unknown"
//       };
//     });

//     const genreSelect = document.getElementById("genreFilter");
//     if (genreSelect) {
//       const genres = ["all", ...new Set(songs.map(d => d.playlist_genre).filter(Boolean))].sort();
//       genres.forEach(g => {
//         const opt = document.createElement("option");
//         opt.value = g;
//         opt.textContent = g;
//         genreSelect.appendChild(opt);
//       });
//     }

//   })
//   .catch(err => console.error("Error loading CSV:", err));






function findSongsByQuery(query) {
  if (!songs.length) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return songs.filter(s => {
    const title  = String(s.track_name).toLowerCase();
    const artist = String(s.track_artist).toLowerCase();
    return title.includes(q) || artist.includes(q);
  });
}




function pickRandomIsHit() {
  if (!songs.length) return null;

  const hits = songs.filter(s => Number(s.is_hit) === 1);

  if (!hits.length) return null;

  const idx = Math.floor(Math.random() * hits.length);
  return hits[idx];
}

function distance(song, mix) {
  const f = (id) => Number(song[id]);
  return (
    Math.pow(f("danceability") - mix.danceability, 2) +
    Math.pow(f("energy")       - mix.energy, 2) +
    Math.pow(f("valence")      - mix.valence, 2) +
    Math.pow(f("tempo")        - mix.tempo, 2) / 10000 + 
    Math.pow(f("loudness")     - mix.loudness, 2) / 10
  );
}

function findSimilarSongs(mix) {
  if (!songs.length) return [];

  return songs
    .filter(song => {
      if (!currentSong) return true;
      return !(
        String(song.track_name)  === String(currentSong.track_name) &&
        String(song.track_artist) === String(currentSong.track_artist)
      );
    })
    .map(song => ({ song, d: distance(song, mix) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(x => x.song);
}



function renderSimilarSongs(mix) {
  const container = document.getElementById("similarSongs");
  container.innerHTML = "";

  const similar = findSimilarSongs(mix);

  if (!similar.length) {
    container.innerHTML = "<p>Loading songs... try again in a second.</p>";
    return;
  }

  similar.forEach(song => {
    const card = document.createElement("div");
    card.className = "song-card";

    const dance  = Number(song.danceability).toFixed(2);
    const energy = Number(song.energy).toFixed(2);
    const val    = Number(song.valence).toFixed(2);

    const popularity = song.track_popularity ?? "N/A";
    const link = song.track_url;  // from JSON

    card.innerHTML = `
      <div class="song-title">${song.track_name}</div>
      <div class="song-artist">${song.track_artist}</div>
      <div class="song-popularity">Popularity: ${popularity}</div>
      <p class="song-note">
        Danceability: ${dance} · Energy: ${energy} · Valence: ${val}
      </p>
      ${
        link
          ? `<a class="song-link" href="${link}" target="_blank" rel="noopener noreferrer">
               ▶ Listen on Spotify
             </a>`
          : ""
      }
    `;

    container.appendChild(card);
  });

  const explainer = document.createElement("p");
  explainer.className = "similar-explainer";
  explainer.textContent =
    "These are the three songs in the dataset closest to your mix in feature space.";
  container.appendChild(explainer);
  renderSimilarComparisonChart(mix, similar);
}

function renderSimilarComparisonChart(mix, similarSongs) {
  const canvas = document.getElementById("similarCompareCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Destroy old chart if it exists so we do not stack things
  if (similarRadarChart) {
    similarRadarChart.destroy();
  }

  // All features we want to compare
  const labels = [
    "Danceability",
    "Energy",
    "Valence",
    "Acousticness",
    "Instrumentalness",
    "Loudness",
    "Tempo"
  ];

  // Helper to clamp between 0 and 1
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // Turn a song / mix object into a 0–1 vector for the radar
  const extractVals = (obj) => {
    const dance  = Number(obj.danceability);
    const energy = Number(obj.energy);
    const val    = Number(obj.valence);
    const ac     = Number(obj.acousticness);
    const instr  = Number(obj.instrumentalness);
    const loud   = Number(obj.loudness); // usually -20 to 0
    const tempo  = Number(obj.tempo);    // usually 60–200

    // normalize loudness (-20 to 0 dB) → 0–1
    const loudNorm  = clamp01((loud + 20) / 20);
    // normalize tempo (0–200 BPM) → 0–1
    const tempoNorm = clamp01(tempo / 200);

    return [
      clamp01(dance),
      clamp01(energy),
      clamp01(val),
      clamp01(ac),
      clamp01(instr),
      loudNorm,
      tempoNorm,
    ];
  };

  const datasets = [];

  // Your mix highlighted
  datasets.push({
    label: "Your mix",
    data: extractVals(mix),
    borderWidth: 2,
    borderColor: "rgba(200, 200, 200, 0.7)",
    backgroundColor: "rgba(200, 200, 200, 0.15)",
    pointRadius: 3,
  });

  const palette = [
    "rgba(255, 127, 227, 0.9)",  
    "rgba(87, 255, 177, 0.9)",  
    "rgba(200, 135, 255, 0.9)", 
  ];



  // Each similar song as a grey line
  similarSongs.forEach((song, i) => {
    const shortName =
      song.track_name.length > 18
        ? song.track_name.slice(0, 18) + "…"
        : song.track_name;

    datasets.push({
      label: shortName,
      data: extractVals(song),
      borderWidth: 1,
      borderColor: palette[i],
      backgroundColor: palette[i].replace("0.9)", "0.15)"),
      pointRadius: 2,
    });
  });

  


  similarRadarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: 1,
          angleLines: { color: "#444" },
          grid: { color: "#222" },
          pointLabels: {
            color: "#f9fafb",
            font: { size: 11 },
          },
          ticks: {
            display: false,
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#f9fafb",
            font: { size: 11 },
          },
        },
      },
    },
  });
}


function renderFeatureHistogramForFeature(featureId, mixValue, containerEl) {
  const container = d3.select(containerEl);
  container.selectAll("*").remove();

  if (!songs.length) return;

  const hitVals = songs
    .filter(d => Number(d.is_hit) === 1 && d[featureId] != null && !isNaN(+d[featureId]))
    .map(d => +d[featureId])
    .filter(v => !isNaN(v));

  const nonHitVals = songs
    .filter(d => Number(d.is_hit) === 0 && d[featureId] != null && !isNaN(+d[featureId]))
    .map(d => +d[featureId])
    .filter(v => !isNaN(v));

  const allVals = hitVals.concat(nonHitVals);


  if (!hitVals.length || !nonHitVals.length) return;

  let datasetA = [];
  let datasetB = [];

  if (histogramMode === "all") {
    datasetA = allVals; 
    datasetB = null;
  } else if (histogramMode === "hit") {
    datasetA = hitVals; 
    datasetB = null;
  } else if (histogramMode === "both") {
    datasetA = nonHitVals; 
    datasetB = hitVals;
  }
  
  const margin = { top: 5, right: 5, bottom: 5, left: 5 };
  const width  = (containerEl.clientWidth || 260) - margin.left - margin.right;
  const height = 100 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width",  width  + margin.left + margin.right)
    .attr("height", height + margin.top  + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain(d3.extent(datasetA)) 
    .nice()
    .range([0, width]);

  const binGen = d3.bin()
    .domain(x.domain())
    .thresholds(15);

  const binsA = binGen(datasetA).map(b => ({ ...b, p: b.length / datasetA.length }));
  const binsB = datasetB ? binGen(datasetB).map(b => ({ ...b, p: b.length / datasetB.length })) : [];

  const maxP = d3.max(
    datasetB ? binsA.concat(binsB) : binsA,
    b => b.p
  ) || 1;

  const y = d3.scaleLinear().domain([0, maxP]).range([height, 0]);

  const moveTooltip = (event, html) => {
    histTooltip
      .style("opacity", 1)
      .html(html)
      .style("left", (event.clientX + 12) + "px")
      .style("top",  (event.clientY + 12) + "px");
  };
  svg.selectAll(".bar-A")
    .data(binsA)
    .enter().append("rect")
      .attr("class", "bar-A")
      .attr("x", d => x(d.x0))
      .attr("y", d => y(d.p))
      .attr("width", d => Math.max(0, x(d.x1) - x(d.x0)))
      .attr("height", d => height - y(d.p))
      .attr("fill", histogramMode === "hit" ? "#ff4faa" :
                    histogramMode === "all" ? "#5fb2ffff" : "#145ea3ff")
      .attr("opacity", histogramMode === "both" ? 0.7 : 0.7)
      .on("mouseenter", function (event, d) {
        d3.select(this)
          .attr("opacity", 1)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 0.5);

        moveTooltip(event, `
          <strong>All songs</strong><br/>
          Range: ${d.x0.toFixed(2)} – ${d.x1.toFixed(2)}<br/>
          Count: ${d.length}<br/>
          Share: ${(d.p * 100).toFixed(1)}%
        `);
      })
      .on("mousemove", function (event, d) {
        moveTooltip(event, `
          <strong>All songs</strong><br/>
          Range: ${d.x0.toFixed(2)} – ${d.x1.toFixed(2)}<br/>
          Count: ${d.length}<br/>
          Share: ${(d.p * 100).toFixed(1)}%
        `);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .attr("opacity", histogramMode === "both" ? 0.7 : 0.7)
          .attr("stroke", "none")
          .attr("fill", histogramMode === "hit" ? "#ff4faa" :
                        histogramMode === "all" ? "#5fb2ffff" : "#145ea3ff");


        histTooltip.style("opacity", 0);
      });

  if (datasetB) {
    svg.selectAll(".bar-B")
      .data(binsB)
      .enter().append("rect")
        .attr("class", "bar-B")
        .attr("x", d => x(d.x0))
        .attr("y", d => y(d.p))
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0)))
        .attr("height", d => height - y(d.p))
        .attr("fill", "#ff4faa")
        .attr("opacity", 0.7)
        .on("mouseenter", function (event, d) {
          d3.select(this)
            .attr("opacity", 1)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 0.7);

          moveTooltip(event, `
            <strong>Hit songs</strong><br/>
            Range: ${d.x0.toFixed(2)} – ${d.x1.toFixed(2)}<br/>
            Count: ${d.length}<br/>
            Share: ${(d.p * 100).toFixed(1)}%
          `);
        })
        .on("mousemove", function (event, d) {
          moveTooltip(event, `
            <strong>Hit songs</strong><br/>
            Range: ${d.x0.toFixed(2)} – ${d.x1.toFixed(2)}<br/>
            Count: ${d.length}<br/>
            Share: ${(d.p * 100).toFixed(1)}%
          `);
        })
        .on("mouseleave", function () {
          d3.select(this)
            .attr("opacity", 0.7)
            .attr("stroke", "none")
            .attr("fill", "#ff4faa");


          histTooltip.style("opacity", 0);
        });
  }




  if (typeof mixValue === "number" && !isNaN(mixValue)) {
    const cx = x(mixValue);
    if (!isNaN(cx)) {
      svg.append("line")
        .attr("x1", cx)
        .attr("x2", cx)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3,2");
    }
  }
}


//  scroll animatinss 

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
          start: "top 85%",
          end: "bottom 60%",
          toggleActions: "play none play reverse",
        }
      }
    );
  });
}



//radar chart stuff
function makeRadarChart(data) {
  const ctx = document.getElementById("radarCanvas").getContext("2d");

  if (radarChart) radarChart.destroy();

  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["danceability", "energy", "valence", "acousticness", "instrumentalness","speechiness", "loudness", "tempo"],
      datasets: [
        {
          label: "All Songs (Mean)",
          data: data.all,
          borderWidth: 2,
          borderColor: "rgba(200,200,200,0.9)",
          backgroundColor: "rgba(200,200,200,0.2)",
        },
        {
          label: "Hit Songs (Mean)",
          data: data.hits,
          borderWidth: 2,
          borderColor: "rgba(0,200,255,0.9)",
          backgroundColor: "rgba(0,200,255,0.2)",
        },
        {
          label: "Filtered Subset (Mean)",
          data: data.filtered,
          borderWidth: 2,
          borderColor: "rgba(255,0,130,0.9)",
          backgroundColor: "rgba(255,0,130,0.2)",
        },
      ]
    },
    options: {
      scales: {
        r: {
          angleLines: { color: "#555" },
          grid: { color: "#222" },
          pointLabels: { color: "#fff", font: { size: 12 } },
          ticks: { color: "#fff", backdropColor: "#000" },
          beginAtZero: true,
          min: 0,
          max: 1
        }
      },
      plugins: {
        legend: {
          labels: { color: "#fff" }
        }
      }
    }
  });
}

function computeMeans(list) {
  if (!list.length) return [0,0,0,0,0,0,0];

  const sum = { danceability:0, energy:0, valence:0, acousticness:0, 
                instrumentalness:0, speechiness: 0, loudness:0, tempo:0 };

  list.forEach(s => {
    sum.danceability += Number(s.danceability);
    sum.energy += Number(s.energy);
    sum.valence += Number(s.valence);
    sum.acousticness += Number(s.acousticness);
    sum.instrumentalness += Number(s.instrumentalness);
    sum.speechiness      += Number(s.speechiness);
    sum.loudness += Number(s.loudness);
    sum.tempo += Number(s.tempo) / 200; 
  });

  const n = list.length;
  return Object.values(sum).map(v => v / n);
}

function updateRadar(filters) {
  const features = ["danceability", "energy", "valence", "acousticness", "instrumentalness", "speechiness", "loudness", "tempo"];

  let filtered = songs;
  console.log(filtered.length)

  if (filters.genre) {
    filtered = filtered.filter(d => d.playlist_genre === filters.genre);
    console.log("After genre filter:", filtered.length);
  }
  else{
    console.log('p', filters)
  }

  if (filters.artist) {
    filtered = filtered.filter(d => (d.track_artist ?? "").toLowerCase().includes(filters.artist));
    console.log("After artist filter:", filtered.length);
  }
  else{
    console.log('o', filters)
  }

  if (filters.durationMin != null) {
    filtered = filtered.filter(d => d.duration_ms >= filters.durationMin * 1000);
    console.log("After durationMin filter:", filtered.length);
  }
  else{
    console.log('poo', filters)
  }

  if (filters.durationMax != null) {
    filtered = filtered.filter(d => d.duration_ms <= filters.durationMax * 1000);
    console.log("After durationMax filter:", filtered.length);
  }
  else{
    console.log('pee', filters)
  }

  if (filters.popularityMin != null) {
    filtered = filtered.filter(d => Number(d.track_popularity) >= filters.popularityMin);
    console.log("After popularityMin filter:", filtered.length);
  }
  else{
    console.log('pe', filters)
  }

  // if (filters.popularityMax != null) {
  //   filtered = filtered.filter(d => Number(d.track_popularity) <= filters.popularityMax);
  //   console.log("After popularityMax filter:", filtered.length);
  // }




  // if (filters.genre) {
  //   filtered = filtered.filter(d => d.playlist_genre === filters.genre);
  // }
  // if (filters.artist) {
  //   filtered = filtered.filter(d => (d.track_artist ?? "").toLowerCase().includes(filters.artist));
  // }
  // if (filters.durationMin != null) filtered = filtered.filter(d => d.duration_ms >= filters.durationMin);
  // if (filters.durationMax != null) filtered = filtered.filter(d => d.duration_ms <= filters.durationMax);
  // if (filters.popularityMin != null) filtered = filtered.filter(d => Number(d.track_popularity) >= filters.popularityMin);
  // if (filters.popularityMax != null) filtered = filtered.filter(d => Number(d.track_popularity) <= filters.popularityMax);

  // Compute min/max for normalization across full dataset
  const featureRanges = {};
  features.forEach(f => {
    const vals = songs.map(s => Number(s[f])).filter(v => !isNaN(v));
    featureRanges[f] = { min: Math.min(...vals), max: Math.max(...vals) };
  });

  // Function to compute mean of features
  function meanFeatures(songArray) {
    const meanObj = {};
    features.forEach(f => {
      const vals = songArray.map(s => Number(s[f])).filter(v => !isNaN(v));
      const meanVal = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      meanObj[f] = normalizeFeature(meanVal, featureRanges[f].min, featureRanges[f].max);
    });
    return meanObj;
  }

  const data = {
    all: features.map(f => meanFeatures(songs)[f]),
    hits: features.map(f => meanFeatures(songs.filter(s => s.is_hit === "1"))[f]),
    filtered: features.map(f => meanFeatures(filtered)[f]),
  };


  console.log("Radar data:", data);

  makeRadarChart(data);
}

let spotifyData = [];
const radarFilters = {
  genre: null,
  artist: null,
  durationMin: null,
  durationMax: null,
  popularityMin: null,
  popularityMax: null
};


async function loadData() {
  console.log("Loading CSV...");

  const response = await fetch("data/spotify_songs_clean.csv");
  const csvText = await response.text();

  spotifyData = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true
  }).data;

  // Build the songs array
  songs = spotifyData.map(s => ({
    track_name: s.track_name,
    track_artist: s.track_artist,
    playlist_genre: s.playlist_genre,
    danceability: s.danceability,
    energy: s.energy,
    valence: s.valence,
    tempo: s.tempo,
    loudness: s.loudness,
    duration_ms: s.duration_ms,
    track_popularity: s.track_popularity,
    instrumentalness: s.instrumentalness,
    acousticness: s.acousticness,
    is_hit: s.is_hit
  }));

  console.log("Songs loaded:", songs.length);
}

function populateGenreDropdown() {
  const genreSelect = document.getElementById("genreFilter");
  if (!genreSelect) return;

  const genres = ["all", ...new Set(songs.map(d => d.playlist_genre).filter(Boolean))].sort();

  genreSelect.innerHTML = "";
  genres.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    genreSelect.appendChild(opt);
  });

  console.log("Genres populated:", genres);
}

function formatMMSS(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function setupEventListeners() {
  console.log("Setting up event listeners...");

  // GENRE FILTER
  const genreSelectEl = document.getElementById("genreFilter");
  if (genreSelectEl) {
    genreSelectEl.addEventListener("change", () => {
      radarFilters.genre = genreSelectEl.value === "all" ? null : genreSelectEl.value;
      updateRadar(radarFilters);
    });
  }

  // DURATION SLIDER (top explorer: id="durationSlider")
  const slider = document.getElementById("duration-slider");
  if (slider) {
    noUiSlider.create(slider, {
      start: [0, 300],        // 0s to 5:00
      connect: true,
      range: {
        min: 0,
        max: 300             // seconds
      },
      step: 1,
      tooltips: false
    });

    const display = document.getElementById("duration-display");
    if (display) {
      // Update text display live
      slider.noUiSlider.on("update", (values) => {
        const minSec = formatMMSS(parseInt(values[0]));
        const maxSec = formatMMSS(parseInt(values[1]));
        display.textContent = `${minSec} — ${maxSec}`;
      });
    }

    // Update filters when the user is done sliding
    slider.noUiSlider.on("set", (values) => {
      radarFilters.durationMin = parseInt(values[0]);  // seconds
      radarFilters.durationMax = parseInt(values[1]);  // seconds
      updateRadar(radarFilters);
    });
  } else {
    console.warn("durationSlider element not found, skipping noUiSlider setup.");
  }

  // POPULARITY FILTER
  const popSlider = document.getElementById("popFilter");
  const popValue = document.getElementById("popValue");

  if (popSlider && popValue) {
    popValue.textContent = popSlider.value;
    popSlider.addEventListener("input", () => {
      const val = Number(popSlider.value);
      popValue.textContent = val;
      radarFilters.popularityMin = val;
      radarFilters.popularityMax = 100;
      updateRadar(radarFilters);
    });
  }

  // ARTIST SEARCH
  const aInput = document.getElementById("artistFilter");
  const aBtn = document.getElementById("ArtistSearchBtn");

  if (aBtn && aInput) {
    aBtn.addEventListener("click", () => handleArtistSearch(aInput.value));
    aInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleArtistSearch(aInput.value);
    });
  }

  // RESET FILTERS BUTTON
  const resetBtn = document.getElementById("resetFiltersBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      console.log("Resetting all filters...");

      // Reset radarFilters
      radarFilters.genre = null;
      radarFilters.artist = null;
      radarFilters.durationMin = null;
      radarFilters.durationMax = null;
      radarFilters.popularityMin = null;
      radarFilters.popularityMax = null;

      // Genre dropdown
      if (genreSelectEl) genreSelectEl.value = "all";

      // Artist input + results
      const artistInput = document.getElementById("artistFilter");
      if (artistInput) artistInput.value = "";
      const artistResults = document.getElementById("ArtistSearchResults");
      if (artistResults) artistResults.innerHTML = "";
      const feedback = document.getElementById("ArtistSearchFeedback");
      if (feedback) feedback.textContent = "";

      // Popularity range
      if (popSlider) popSlider.value = 0;
      if (popValue) popValue.textContent = "0";

      // Duration slider
      const durationSlider = document.getElementById("durationSlider");
      if (durationSlider && durationSlider.noUiSlider) {
        durationSlider.noUiSlider.set([0, 300]); // full range
      }

      updateRadar(radarFilters);
    });
  }
}



// function handleArtistSearch(query) {
//     console.log("handleArtistSearch called with query:", query);

//     if (!songs.length) return;

//     const q = query.trim().toLowerCase();
//     if (!q) return;

//     const matches = songs.filter(s => {
//       const artist = String(s.track_artist ?? "").toLowerCase();
//       return artist.includes(q);
//     });

//     console.log("Matches found:", matches.length);

//     const saResults = document.getElementById("ArtistSearchResults");
//     const saFeedback = document.getElementById("ArtistSearchFeedback");
//     if (!saResults || !saFeedback) return;

//     saResults.innerHTML = "";

//     if (!matches.length) {
//       saFeedback.textContent = "No artists found matching that query.";
//       return;
//     }

//     saFeedback.textContent = matches.length === 1
//       ? "Found 1 artist. Click to use it:"
//       : `Found ${matches.length} artists. Pick one:`;

//     const seen = new Set();
//     matches.forEach(song => {
//       const artistName = song.track_artist;
//       if (seen.has(artistName)) return;
//       seen.add(artistName);

//       const item = document.createElement("div");
//       item.className = "search-result-item";
//       item.textContent = artistName;
//       item.addEventListener("click", () => {
//         radarFilters.artist = artistName.toLowerCase();
//         updateRadar(radarFilters);

//         saResults.innerHTML = "";
//         saFeedback.textContent = `Showing: ${artistName}`;
//       });
//       saResults.appendChild(item);
//     });
//   }


function handleArtistSearch(query) {
  query = query.trim().toLowerCase();
  if (!query) return;

  const matches = songs.filter(s =>
    String(s.track_artist ?? "").toLowerCase().includes(query)
  );

  const container = document.getElementById("ArtistSearchResults");
  const feedback = document.getElementById("ArtistSearchFeedback");

  if (!container || !feedback) return;

  container.innerHTML = "";
  if (!matches.length) {
    feedback.textContent = "No artists found.";
    return;
  }

  const artistNames = matches.map(song => song.track_artist);

  // Count unique names
  const uniqueCount = new Set(artistNames).size;

  feedback.textContent = `Found ${uniqueCount} artist(s):`;
  //feedback.textContent = `Found ${matches.length} artist(s):`;
  const seen = new Set();

  matches.forEach(s => {
    if (seen.has(s.track_artist)) return;
    seen.add(s.track_artist);

    const div = document.createElement("div");
    div.className = "search-result-item";
    div.textContent = s.track_artist;
    div.onclick = () => {
      radarFilters.artist = s.track_artist.toLowerCase();
      updateRadar(radarFilters);
      container.innerHTML = "";
      feedback.textContent = `Showing: ${s.track_artist}`;
    };
    container.appendChild(div);
  });
}




// this the main thing

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");
  

  // Landing: feature-importance chart
  initFeatureImportanceChart();
  setupProgressDots();

  const getStartedBtn = document.getElementById("getStartedBtn");
  const dataExplorer  = document.getElementById("data-explorer");
  const mixingBoard   = document.querySelector(".mixing-board");

  if (getStartedBtn) {
    getStartedBtn.addEventListener("click", () => {
      // 1. Reveal the rest of the page
      if (dataExplorer) {
        dataExplorer.classList.remove("hidden");
      }
      
      

      // 2. Scroll into the data explorer (first section after hero)
      if (dataExplorer) {
        dataExplorer.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  }

  let mixingInitialized = false;

const toMixingBoardBtn = document.getElementById("toMixingBoardBtn");


if (toMixingBoardBtn) {
  toMixingBoardBtn.addEventListener("click", () => {
    mixingBoard.classList.remove("hidden");

    if (!mixingInitialized) {
      createVerticalSliders();
      mixingInitialized = true;
    }

    mixingBoard.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

  let currentSongValues = null;





  const results = document.getElementById("results");

  const runModel = async ({ trigger = "other" } = {}) => {
  results.classList.remove("hidden");

  const mix = { ...userValues };
  currentSongValues = mix;
    
  const prob = computeHitProbability(mix);

  // if CREATE SONG and prob >= 0.08 → celebrate
  if (trigger === "create" && prob >= 0.08) {
    fireConfetti();
  }

  renderPredictedResult(prob);
  await songsPromise;

  if (!songs.length) {
    const container = document.getElementById("comparisonViz");
    if (container) {
      container.innerHTML = "<p style='color:#ddd'>Data still loading or failed to load — try again in a second.</p>";
    }
  } else {
    renderComparisonViz(mix);
    renderSimilarSongs(mix);
  }

  gsap.to(results, { opacity: 1, duration: 0.6 });
  enableScrollSections();
};

  const createBtn = document.getElementById("createSongBtn");
  function updateUserSongLabelFromInputs() {
  const titleInput  = document.getElementById("userSongTitle");
  const artistInput = document.getElementById("userSongArtist");
  const labelEl     = document.getElementById("userSongLabel");

  if (!labelEl) return;

  const rawTitle  = titleInput  ? titleInput.value.trim()  : "";
  const rawArtist = artistInput ? artistInput.value.trim() : "";

  const title  = rawTitle  || "Untitled track";
  const artist = rawArtist || "Unknown artist";

  labelEl.innerHTML = `
    <div class="song-card user-song-card">
      <div class="song-title">${title}</div>
      <div class="song-artist">${artist}</div>
      <div class="song-popularity">
        Your custom song
      </div>
    </div>
  `;
}

  document.getElementById("createSongBtn").addEventListener("click", () => {
    currentSong = null;

    const infoEl = document.getElementById("hitSongInfo");
    if (infoEl) {
      infoEl.textContent = "";
    }

    updateUserSongLabelFromInputs();
    runModel({ trigger: "create" });
  });



  document.querySelectorAll("input[name='histMode']").forEach(radio => {
    radio.addEventListener("change", e => {
      histogramMode = e.target.value;
      renderComparisonViz(currentSongValues); 
    });
  });
    



  const alreadyBtn = document.getElementById("alreadyHitBtn");
  if (alreadyBtn) {
    alreadyBtn.addEventListener("click", () => {
      const hitSong = pickRandomIsHit();
      if (!hitSong) {
        alert("No hit songs (is_hit == 1) found in the dataset.");
        return;
      }

      currentSong = hitSong;

      const saInput    = document.getElementById("songArtistSearchInput");
      const saFeedback = document.getElementById("songArtistSearchFeedback");
      const saResults  = document.getElementById("songArtistSearchResults");

      if (saInput)    saInput.value = "";
      if (saFeedback) saFeedback.textContent = "";
      if (saResults)  saResults.innerHTML = "";

      const preset = {
        tempo:            Number(hitSong.tempo),
        danceability:     Number(hitSong.danceability),
        energy:           Number(hitSong.energy),
        valence:          Number(hitSong.valence),
        instrumentalness: Number(hitSong.instrumentalness),
        acousticness:     Number(hitSong.acousticness),
        loudness:         Number(hitSong.loudness),
      };

      const labelEl = document.getElementById("userSongLabel");
      if (labelEl) {
        const pop  = hitSong.track_popularity ?? "N/A";
        const link = hitSong.track_url;

        labelEl.innerHTML = `
          <div class="song-card user-song-card">
            <div class="song-title">${hitSong.track_name}</div>
            <div class="song-artist">${hitSong.track_artist}</div>
            <div class="song-popularity">Actual Spotify popularity: ${pop}</div>
            ${
              link
                ? `<a class="song-link" href="${link}" target="_blank" rel="noopener noreferrer">
                     ▶ Listen on Spotify
                  </a>`
                : ""}</div>`;}

      setPresetValues(preset);
      runModel();
    });
  }

  
  const histExplainBtn   = document.getElementById("histExplainBtn");
  const histExplainPanel = document.getElementById("histExplainPanel");

  if (histExplainBtn && histExplainPanel) {
    histExplainBtn.addEventListener("click", () => {
      const shouldShow = histExplainPanel.classList.contains("hidden");
      histExplainPanel.classList.toggle("hidden");

      histExplainBtn.textContent = shouldShow
        ? "Hide explanation"
        : "What am I looking at?";
    });
  }


  function applySongToSliders(song) {
  currentSong = song; 

  const labelEl = document.getElementById("userSongLabel");
  if (labelEl) {
    const pop  = song.track_popularity ?? "N/A";
    const link = song.track_url;

    labelEl.innerHTML = `
      <div class="song-card user-song-card">
        <div class="song-title">${song.track_name}</div>
        <div class="song-artist">${song.track_artist}</div>
        <div class="song-popularity">Actual Spotify popularity: ${pop}</div>
        ${
          link
            ? `<a class="song-link" href="${link}" target="_blank" rel="noopener noreferrer">
                 ▶ Listen on Spotify
               </a>`
            : ""
        }
      </div>
    `;
  }

  const preset = {
    tempo:            Number(song.tempo),
    danceability:     Number(song.danceability),
    energy:           Number(song.energy),
    valence:          Number(song.valence),
    instrumentalness: Number(song.instrumentalness),
    acousticness:     Number(song.acousticness),
    loudness:         Number(song.loudness),
  };

  setPresetValues(preset);
  runModel();
}


  const saInput = document.getElementById("songArtistSearchInput");
  const saBtn = document.getElementById("songArtistSearchBtn");
  const saFeedback = document.getElementById("songArtistSearchFeedback");
  const saResults = document.getElementById("songArtistSearchResults");

  const handleUnifiedSearch = () => {
    if (!saInput) return;
    const query = saInput.value;
    saResults.innerHTML = "";

    if (!query.trim()) {
      if (saFeedback) {
        saFeedback.textContent = "Type a song title or artist first.";
      }
      return;
    }

    const matches = findSongsByQuery(query);

    if (!matches.length) {
      if (saFeedback) {
        saFeedback.textContent = "No songs matching that title or artist were found in this dataset.";
      }
      return;
    }

    if (saFeedback) {
      const label = matches.length === 1
        ? "Found 1 match. Click to use it:"
        : `Found matches. Pick one:`;
      saFeedback.textContent = label;
    }

    matches.slice(0, 10).forEach(song => {
      const item = document.createElement("div");
      item.className = "search-result-item";

      const pop = song.track_popularity ?? "N/A";

      item.innerHTML = `
        <div class="search-result-title">${song.track_name}</div>
        <div class="search-result-artist">${song.track_artist}</div>
        <div class="search-result-pop">Popularity: ${pop}</div>
      `;

      item.addEventListener("click", () => {
        if (saFeedback) {
          saFeedback.textContent = `Showing: ${song.track_name} by ${song.track_artist}`;
        }
        saResults.innerHTML = ""; 
        applySongToSliders(song);
      });

      saResults.appendChild(item);
    });
  };

  if (saBtn) {
    saBtn.addEventListener("click", handleUnifiedSearch);
  }
  if (saInput) {
    saInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleUnifiedSearch();
      }
    });
  }

  const hintToggle = document.getElementById("hintToggle");
  const hintPanel  = document.getElementById("hintPanel");

  if (hintToggle && hintPanel) {
    hintToggle.addEventListener("click", () => {
      const isHidden = hintPanel.classList.contains("hidden");
      if (isHidden) {
        hintPanel.classList.remove("hidden");
        hintToggle.textContent = "Hide hint";
      } else {
        hintPanel.classList.add("hidden");
        hintToggle.textContent = "Need a hint?";
      }
    });
  }

  // songsPromise.then(() => {
  //   const genreSelect = document.getElementById("genreFilter");
  //   console.log("genreSelect:", genreSelect);
  //   if (!genreSelect) return;

  //   const genres = ['all', ...new Set(songs.map(d => d.playlist_genre).filter(Boolean))].sort();
  //   console.log("Genres found:", genres);


  //   genreSelect.innerHTML = "";
  //   genres.forEach(g => {
  //     const opt = document.createElement("option");
  //     opt.value = g;
  //     opt.textContent = g;
  //     genreSelect.appendChild(opt);
  //   });
  // });

  
// songsPromise.then(() => {
//   songs = spotifyData.map(s => ({
//     track_name: s.track_name,
//     track_artist: s.track_artist,
//     playlist_genre: s.playlist_genre,
//     danceability: s.danceability,
//     energy: s.energy,
//     valence: s.valence,
//     tempo: s.tempo,
//     loudness: s.loudness,
//     duration_ms: s.duration_ms,
//     track_popularity: s.track_popularity,
//     instrumentalness: s.instrumentalness,
//     acousticness: s.acousticness
//   }));

//   updateRadar(radarFilters);

// });
  



  

  

  const aInput = document.getElementById("artistFilter");
  const aBtn = document.getElementById("ArtistSearchBtn");

  if (aBtn) {
    aBtn.addEventListener("click", () => handleArtistSearch(aInput.value));
  }

  if (aInput) {
    aInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleArtistSearch(aInput.value);
    });
  }

  const startOverBtn = document.getElementById("startOverBtn");

if (startOverBtn) {
  startOverBtn.addEventListener("click", () => {
    // 1) Smooth scroll back to the mixing board
    const mixingBoard = document.querySelector(".mixing-board");
    if (mixingBoard) {
      mixingBoard.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } else {
      // fallback just in case
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // 2) Clear any song info / labels
    const infoEl = document.getElementById("hitSongInfo");
    if (infoEl) infoEl.textContent = "";

    const labelEl = document.getElementById("userSongLabel");
    if (labelEl) labelEl.textContent = "Your custom mix";

    // 3) Clear custom title / artist inputs
    const titleInput  = document.getElementById("userSongTitle");
    const artistInput = document.getElementById("userSongArtist");
    if (titleInput)  titleInput.value = "";
    if (artistInput) artistInput.value = "";

    // 4) Reset sliders back to defaults
    setPresetValues({
      tempo: 120,
      danceability: 0.5,
      energy: 0.6,
      valence: 0.5,
      instrumentalness: 0.0,
      speechiness: 0.05,
      acousticness: 0.3,
      loudness: -6
    });

    // 5) Optionally hide / fade out results
    const results = document.getElementById("results");
    if (results) {
      gsap.to(results, {
        opacity: 0,
        duration: 0.4,
        onComplete: () => {
          results.classList.add("hidden");
          results.style.opacity = 1;
        }
      });
    }
  });
}


});


document.addEventListener("DOMContentLoaded", async () => {
  await loadData();          // 🟢 wait for CSV
  populateGenreDropdown();   // 🟢 now songs exist
  setupEventListeners();     // 🟢 now UI can react
  updateRadar(radarFilters); // 🟢 initial chart
});