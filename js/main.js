import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { initLoader } from "./modules/loader.js";
import { initHero } from "./modules/hero.js";

// Módulos não-críticos serão carregados via import() dinâmico
// para reduzir o tempo de execução inicial (TBT).

gsap.registerPlugin(ScrollTrigger);

function initLenis() {
  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: "vertical",
    smoothWheel: true,
  });
  window.__lenis = lenis;
  document.documentElement.classList.add("lenis");

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

async function onReady() {
  const lenis = initLenis();
  await initLoader(gsap);

  document.body.classList.add("is-loaded");

  // O Hero é vital para o LCP. Inicializa imediatamente.
  initHero(gsap, ScrollTrigger);

  // Carregamento diferido de módulos interativos de baixo do fold
  // Usamos requestIdleCallback para não competir com a renderização inicial
  const loadDeferred = async () => {
    try {
      const [
        { initNav }, { initTabs }, { initCounters }, { initForms },
        { initParallax }, { initLeisureAmenityCards }, { initGallery },
        { initLazer }, { initVidPlayer }, { initPlantaZoom },
        { initSectionAnimations }
      ] = await Promise.all([
        import("./modules/nav.js"),
        import("./modules/tabs.js"),
        import("./modules/counters.js"),
        import("./modules/forms.js"),
        import("./modules/parallax.js"),
        import("./modules/leisure-amenity-cards.js"),
        import("./modules/gallery.js"),
        import("./modules/lazer.js"),
        import("./modules/vidplayer.js"),
        import("./modules/planta-zoom.js"),
        import("./modules/sections.js")
      ]);

      initNav();
      initTabs(gsap);
      initCounters(gsap, ScrollTrigger);
      initForms();
      initParallax(gsap, ScrollTrigger);
      initLeisureAmenityCards();
      initGallery(gsap);
      initLazer(gsap);
      initVidPlayer();
      initPlantaZoom();
      initSectionAnimations(gsap);

      // NÃO chamar ScrollTrigger.refresh() aqui — o hero tem altura CSS fixa
      // e não precisa de recálculo. Um refresh tardio causa jank no hero.
    } catch (err) {
      console.error("Erro ao carregar módulos diferidos:", err);
    }
  };

  // Aguarda 3s antes de carregar módulos secundários para não competir
  // com o carregamento dos frames do hero na primeira visita.
  setTimeout(loadDeferred, 3000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    onReady().catch(console.error);
  });
} else {
  onReady().catch(console.error);
}
