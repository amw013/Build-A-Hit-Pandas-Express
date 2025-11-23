import { createVerticalSliders, userValues } from './verticalSliders.js';
gsap.registerPlugin(ScrollTrigger);

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

window.addEventListener("DOMContentLoaded", () => {
  createVerticalSliders();

  document.getElementById("createSongBtn").addEventListener("click", () => {
    const results = document.getElementById("results");
    results.classList.remove("hidden");
    gsap.to(results, { opacity: 1, duration: 0.6 });
    enableScrollSections();
  });
});
