import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { createVerticalSliders, userValues, setPresetValues } from './verticalSliders.js';
gsap.registerPlugin(ScrollTrigger);


console.log("script.js loaded");

function logistic(score) {
  return 1 / (1 + Math.exp(-score));
}



function computeHitProbability(values) {
  const dance       = values.danceability;
  const energy      = values.energy;
  const valence     = values.valence;
  const acoustic    = values.acousticness;
  const instr       = values.instrumentalness;

  const speech      = 0.05;
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





function describeProbability(p) {
  const isRealHit =
    currentSong && currentSong.track_popularity != null &&
    currentSong.track_popularity >= 80;

  if (isRealHit) {
    return "this already  a hit, the model is just trying to reverse-engineer why it works";
  }

  if (p < 0.02) {
    return "idk man this lowkey not it";
  } else if (p < 0.04) {
    return "it lowkey got potential";
  } else if (p < 0.07) {
    return "this is it";
  } else {
    return "holy frick ur cracked";
  }
}

function closingSummary(p) {
  const isRealHit =
    currentSong && currentSong.track_popularity != null &&
    currentSong.track_popularity >= 80;

  if (isRealHit) {
    return "this track is actually a banger but the model under-rates it, that just shows how much things like marketing, fandom, and vibes matter beyond audio features";
  }

  if (p < 0.02) {
    return "bum ahh song";
  } else if (p < 0.04) {
    return "this aight";
  } else if (p < 0.07) {
    return "yuhhh";
  } else {
    return "get in the booth cuh ts fire";
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
      <div class="feature-name">${f.label}</div>
      <div class="feature-bar-bg">
        <div class="feature-bar-fill" style="width: ${w}%;"></div>
      </div>
      <div class="feature-value">${displayVal}</div>
    `;

    container.appendChild(row);
  });
}
//  similar songs 

let songs = [];
let currentSong = null;

d3.json("data/spotify_web_subset.json").then(data => {
  songs = data;
  console.log("Loaded songs:", songs.length);
  console.log("First song example:", songs[0]);
});

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

// this the main thing

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");
  createVerticalSliders();

  const results = document.getElementById("results");

  const runModel = () => {
    results.classList.remove("hidden");

    const mix = { ...userValues };
    const prob = computeHitProbability(mix);

    renderPredictedResult(prob);
    renderComparisonViz(mix);
    renderSimilarSongs(mix);

    gsap.to(results, { opacity: 1, duration: 0.6 });
    enableScrollSections();
  };

  document.getElementById("createSongBtn").addEventListener("click", () => {
    currentSong = null;
    const infoEl = document.getElementById("hitSongInfo");
    if (infoEl) {
      infoEl.textContent = "";
    }
    runModel();
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

    const saInput     = document.getElementById("songArtistSearchInput");
    const saFeedback  = document.getElementById("songArtistSearchFeedback");
    const saResults   = document.getElementById("songArtistSearchResults");

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

    const infoEl = document.getElementById("hitSongInfo");
    if (infoEl) {
      const pop = hitSong.track_popularity ?? "N/A";
      infoEl.textContent =
        `Using song: ${hitSong.track_name} — ${hitSong.track_artist} (popularity ${pop})`;
    }

    setPresetValues(preset);
    runModel();
  });
}

function applySongToSliders(song) {
  currentSong = song; 

  const infoEl = document.getElementById("hitSongInfo");
  if (infoEl) {
    infoEl.textContent = "";
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
});
