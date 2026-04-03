/**
 * Lazer Stage — seletor por amenidade individual
 *
 * Auto-advance em dois níveis encadeados:
 *   • Timer avança amenidade por amenidade (AMENITY_MS cada)
 *   • Ao chegar na última amenidade da zona → avança para a próxima zona
 *   • Na nova zona começa pela primeira amenidade e reinicia o ciclo
 *
 * Interação manual:
 *   • Clicar numa amenidade: exibe ela e reinicia o timer a partir daí
 *   • Clicar num tab de zona: vai para a primeira amenidade daquela zona
 */
export function initLazer(gsap) {
  const stage = document.getElementById("lz-stage");
  if (!stage) return;

  const video        = stage.querySelector("#lz-video");
  const crossfadeEl  = stage.querySelector("#lz-crossfade");
  const navBtns      = [...stage.querySelectorAll(".lz-nav__btn:not(.lz-nav__btn--clone)")];
  const amenityGrids = [...stage.querySelectorAll(".lz-amenity-grid")];
  const zoneEl       = stage.querySelector("[data-lz-zone]");
  const nameEl       = stage.querySelector("[data-lz-name]");
  const fillEl       = stage.querySelector(".lz-progress__fill");

  const ZONES = ["resort", "work", "spa", "rooftop"];
  const ZONE_NAMES = {
    resort:  "Pavimento Resort",
    work:    "Work & Business",
    spa:     "Spa Suspenso",
    rooftop: "Rooftop +150m",
  };

  const AMENITY_MS = 5000; /* tempo por amenidade — 5s máximo dos vídeos Marlon */
  const FADE_MS    = 220;  /* crossfade entre amenidades */

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let currentZone    = null;
  let currentAmenity = null;
  let timer          = null;
  let progressRaf    = null;

  /* ─────────────────────────────────────────────────────────
   * Utilitário: retorna todos os botões de amenidade da zona
   * ───────────────────────────────────────────────────────── */
  function getAmenityBtns(zone) {
    const grid = stage.querySelector(`#lz-amenities-${zone}`);
    return grid ? [...grid.querySelectorAll(".lz-amenity-btn")] : [];
  }

  function getActiveAmenityBtn() {
    return stage.querySelector(
      `#lz-amenities-${currentZone} .lz-amenity-btn.is-active`
    );
  }

  /* ─────────────────────────────────────────────────────────
   * switchAmenity — exibe amenidade no stage (com crossfade)
   * ───────────────────────────────────────────────────────── */
  function switchAmenity(btn, skipCrossfade) {
    if (!btn) return;

    const zone    = btn.dataset.zone;
    const amenity = btn.dataset.amenity;
    const label   = btn.dataset.label;
    const vidSrc  = btn.dataset.video;

    if (amenity === currentAmenity && zone === currentZone) return;
    currentAmenity = amenity;

    /* Highlight */
    stage.querySelectorAll(".lz-amenity-btn.is-active")
         .forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    /* Caption */
    if (nameEl) nameEl.textContent = label;

    /* Crossfade */
    const doFade = !reduce && !skipCrossfade && crossfadeEl;
    if (doFade) crossfadeEl.classList.add("is-fading");

    setTimeout(() => {
      if (video) {
        if (vidSrc) {
          video.src = vidSrc;
          video.load();
          video.play().catch(() => {});
        } else {
          video.removeAttribute("src");
          video.load();
        }
      }
      if (doFade) crossfadeEl.classList.remove("is-fading");
    }, doFade ? FADE_MS : 0);
  }

  /* ─────────────────────────────────────────────────────────
   * switchZone — troca de zona, entra na 1ª amenidade
   * ───────────────────────────────────────────────────────── */
  function switchZone(zoneName, skipCrossfade) {
    if (currentZone === zoneName) return;
    currentZone = zoneName;

    /* Tabs — atualiza botões reais e clones */
    stage.querySelectorAll(".lz-nav__btn").forEach(b => {
      const active = b.dataset.scene === zoneName;
      b.classList.toggle("is-active", active);
      if (!b.classList.contains("lz-nav__btn--clone")) {
        b.setAttribute("aria-selected", String(active));
      }
    });

    /* Caption da zona */
    if (zoneEl) zoneEl.textContent = ZONE_NAMES[zoneName];

    /* Grids */
    amenityGrids.forEach(g => {
      g.hidden = g.id !== `lz-amenities-${zoneName}`;
    });

    /* Animação de entrada dos botões */
    const grid = stage.querySelector(`#lz-amenities-${zoneName}`);
    if (grid && gsap && !reduce) {
      gsap.from(grid.querySelectorAll(".lz-amenity-btn"), {
        opacity: 0, y: 6, stagger: 0.035,
        duration: 0.32, ease: "power2.out", clearProps: "all",
      });
    }

    /* Seleciona 1ª amenidade da nova zona */
    stage.querySelectorAll(".lz-amenity-btn.is-active")
         .forEach(b => b.classList.remove("is-active"));
    currentAmenity = null;
    const firstBtn = grid?.querySelector(".lz-amenity-btn");
    if (firstBtn) switchAmenity(firstBtn, skipCrossfade);
  }

  /* ─────────────────────────────────────────────────────────
   * Barra de progresso — duração = AMENITY_MS
   * ───────────────────────────────────────────────────────── */
  function startProgress() {
    if (!fillEl || reduce) return;
    if (progressRaf) cancelAnimationFrame(progressRaf);
    fillEl.style.transition = "none";
    fillEl.style.width = "0%";
    progressRaf = requestAnimationFrame(() => {
      progressRaf = requestAnimationFrame(() => {
        fillEl.style.transition = `width ${AMENITY_MS}ms linear`;
        fillEl.style.width = "100%";
      });
    });
  }

  function stopProgress() {
    if (progressRaf) cancelAnimationFrame(progressRaf);
    if (fillEl) { fillEl.style.transition = "none"; fillEl.style.width = "0%"; }
  }

  /* ─────────────────────────────────────────────────────────
   * advanceNext — lógica de avanço: amenidade → amenidade → zona
   * ───────────────────────────────────────────────────────── */
  function advanceNext() {
    const btns      = getAmenityBtns(currentZone);
    const activeBtn = getActiveAmenityBtn();
    const idx       = btns.indexOf(activeBtn);
    const nextIdx   = idx + 1;

    if (nextIdx < btns.length) {
      /* Ainda há amenidades nesta zona — avança para a próxima */
      switchAmenity(btns[nextIdx]);
    } else {
      /* Última amenidade da zona — avança para a próxima zona */
      const nextZone = ZONES[(ZONES.indexOf(currentZone) + 1) % ZONES.length];
      switchZone(nextZone);
    }

    schedule();
  }

  /* ─────────────────────────────────────────────────────────
   * schedule / stopSchedule
   * ───────────────────────────────────────────────────────── */
  function schedule() {
    clearTimeout(timer);
    startProgress();
    timer = setTimeout(advanceNext, AMENITY_MS);
  }

  function stopSchedule() {
    clearTimeout(timer);
    stopProgress();
  }

  /* ─────────────────────────────────────────────────────────
   * Eventos
   * ───────────────────────────────────────────────────────── */

  /* Clique em tab de zona → vai para 1ª amenidade + reinicia timer */
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      switchZone(btn.dataset.scene);
      schedule();
    });
  });

  /* Cliques nos botões-clone do marquee (mobile): delega para a zona real */
  const lzNav = stage.querySelector(".lz-nav");
  if (lzNav) {
    const lzTrack = lzNav.querySelector(".lz-nav__track");

    lzNav.addEventListener("click", e => {
      const clone = e.target.closest(".lz-nav__btn--clone");
      if (!clone) return;
      switchZone(clone.dataset.scene);
      schedule();
    });

    /* ── Mobile marquee: tap não pausa; drag pausa e permite scroll manual ── */
    const MARQUEE_DUR = 20; // segundos — deve bater com o @keyframes no CSS

    let touch       = null;   // { x: number } do touchstart
    let dragActive  = false;  // true se o gesto foi identificado como drag
    let frozenX     = 0;      // translateX no momento do freeze
    let resumeTimer = null;

    /* Lê o translateX atual do track (mesmo enquanto animando) */
    function getTrackX() {
      const m = new DOMMatrix(window.getComputedStyle(lzTrack).transform);
      return m.m41;
    }

    /* Para a animação CSS e assume controle manual via style.transform */
    function freezeTrack() {
      frozenX = getTrackX();
      lzTrack.style.animation  = "none";
      lzTrack.style.transform  = `translateX(${frozenX}px)`;
      lzNav.classList.add("is-paused");
    }

    /* Retoma a animação a partir da posição x, sem salto visível */
    function resumeTrack(x) {
      const halfW = lzTrack.scrollWidth / 2;
      if (!halfW) return;
      let normX = x % -halfW;
      if (normX > 0) normX = 0;
      const progress = Math.abs(normX) / halfW;           // 0 → 1
      const delay    = (-(progress * MARQUEE_DUR)).toFixed(3); // negativo
      lzTrack.style.removeProperty("transform");
      lzTrack.style.animation = `lz-nav-marquee ${MARQUEE_DUR}s linear ${delay}s infinite`;
      lzNav.classList.remove("is-paused");
    }

    lzNav.addEventListener("touchstart", e => {
      touch      = { x: e.touches[0].clientX };
      dragActive = false;
      clearTimeout(resumeTimer);
    }, { passive: true });

    lzNav.addEventListener("touchmove", e => {
      if (!touch) return;
      const dx = e.touches[0].clientX - touch.x;

      /* Identifica drag a partir de 10 px de deslocamento horizontal */
      if (!dragActive && Math.abs(dx) > 10) {
        dragActive = true;
        freezeTrack();
      }

      if (dragActive) {
        const halfW = lzTrack.scrollWidth / 2;
        const newX  = Math.max(-halfW, Math.min(0, frozenX + dx));
        lzTrack.style.transform = `translateX(${newX}px)`;
      }
    }, { passive: true });

    lzNav.addEventListener("touchend", () => {
      if (dragActive) {
        /* Extrai posição final e agenda retomada do marquee */
        const m      = lzTrack.style.transform.match(/translateX\((-?[\d.]+)px\)/);
        const finalX = m ? parseFloat(m[1]) : frozenX;
        resumeTimer  = setTimeout(() => {
          dragActive = false;
          resumeTrack(finalX);
        }, 2000);
      }
      touch = null;
    }, { passive: true });
  }

  /* Clique em amenidade → exibe ela + reinicia timer a partir daí */
  stage.addEventListener("click", e => {
    const btn = e.target.closest(".lz-amenity-btn");
    if (!btn) return;
    switchAmenity(btn);
    schedule();
  });

  /* Teclado (setas): navega entre zonas quando focus nos tabs */
  stage.addEventListener("keydown", e => {
    const focused = document.activeElement?.closest(".lz-nav__btn");
    if (!focused) return;
    const dir = (e.key === "ArrowRight" || e.key === "ArrowDown")  ?  1
              : (e.key === "ArrowLeft"  || e.key === "ArrowUp")    ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = ZONES[(ZONES.indexOf(focused.dataset.scene) + dir + ZONES.length) % ZONES.length];
    switchZone(next);
    schedule();
    stage.querySelector(`.lz-nav__btn[data-scene="${next}"]`)?.focus();
  });

  /* IntersectionObserver: pausa quando fora da viewport */
  new IntersectionObserver(entries => {
    entries.forEach(e => e.isIntersecting ? schedule() : stopSchedule());
  }, { threshold: 0.25 }).observe(stage);

  /* ─────────────────────────────────────────────────────────
   * Init
   * ───────────────────────────────────────────────────────── */
  currentZone = null;
  switchZone("resort", true);
}
