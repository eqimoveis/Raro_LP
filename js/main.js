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
    duration: 1.0,          // reduzido de 1.15 — mais responsivo para scroll-linked animation
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
  initLenis();

  // Hero inicia em paralelo com o loader — frame 241 carrega enquanto o loader
  // ainda está visível, então quando o loader sobe o canvas já está pronto.
  // refreshOnLoaderExit é chamado depois do ScrollTrigger.refresh() pós-loader.
  const { refreshOnLoaderExit } = initHero(gsap, ScrollTrigger);

  await initLoader(gsap);

  // Loader saiu: overflow:hidden removido, layout correto agora.
  // Dois rAFs garantem que o browser processou o reflow antes do refresh.
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  ScrollTrigger.refresh();
  refreshOnLoaderExit?.();

  document.body.classList.add("is-loaded");

  // Carregamento diferido de módulos interativos de baixo do fold.
  // requestIdleCallback garante que não compete com a renderização inicial.
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

      // Segundo refresh: consolida triggers dos módulos diferidos com layout final.
      ScrollTrigger.refresh();
    } catch (err) {
      console.error("Erro ao carregar módulos diferidos:", err);
    }
  };

  if (window.requestIdleCallback) {
    requestIdleCallback(() => loadDeferred());
  } else {
    setTimeout(loadDeferred, 200);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    onReady().catch(console.error);
  });
} else {
  onReady().catch(console.error);
}
