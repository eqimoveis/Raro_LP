/**
 * Section animations — RARO Praia Brava
 * Brad Frost principle: build in systems, not one-offs.
 * Each helper is a reusable atom. Sections compose them.
 */

/* ── Shared helpers ───────────────────────────────────────── */

function revealY(gsap, el, { y = 30, dur = 1.0, delay = 0, ease = "power2.out", start = "top 88%" } = {}) {
  if (!el) return;
  gsap.from(el, {
    y,
    opacity: 0,
    duration: dur,
    delay,
    ease,
    scrollTrigger: { trigger: el, start },
  });
}

function revealStagger(gsap, els, { y = 24, dur = 0.85, stagger = 0.07, ease = "power2.out", trigger, start = "top 85%" } = {}) {
  if (!els || !els.length) return;
  gsap.from(els, {
    y,
    opacity: 0,
    stagger,
    duration: dur,
    ease,
    scrollTrigger: { trigger: trigger || els[0], start },
  });
}

function revealScale(gsap, el, { from = 0.88, dur = 1.0, ease = "power3.out", start = "top 86%" } = {}) {
  if (!el) return;
  gsap.from(el, {
    scale: from,
    opacity: 0,
    duration: dur,
    ease,
    scrollTrigger: { trigger: el, start },
  });
}

/* ── Main export ──────────────────────────────────────────── */

export function initSectionAnimations(gsap) {
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduce) {
    gsap.set(".js-hero-defer", { opacity: 1, clearProps: "opacity" });
    return;
  }

  /* ── Kickers — all at once ─────────────────────────────── */
  document.querySelectorAll(".js-section-kicker").forEach((k) => {
    gsap.from(k, {
      y: 14,
      opacity: 0,
      duration: 0.9,
      ease: "power2.out",
      scrollTrigger: { trigger: k, start: "top 90%" },
    });
  });

  /* ── Subtitles ─────────────────────────────────────────── */
  document.querySelectorAll(".js-section-subtitle").forEach((s) => {
    revealY(gsap, s, { y: 18, dur: 0.85, start: "top 88%" });
  });

  /* ── LOCALIZAÇÃO ───────────────────────────────────────── */
  const loc = document.querySelector("#localizacao");
  if (loc) {
    revealY(gsap, loc.querySelector(".js-section-title"), { y: 36, dur: 1.1, ease: "power3.out", start: "top 78%" });
    revealY(gsap, loc.querySelector(".js-section-lead"),  { y: 24, dur: 1.0, start: "top 88%" });

    const statCards = [...loc.querySelectorAll(".stat-card")];
    revealStagger(gsap, statCards, {
      y: 40,
      dur: 0.9,
      stagger: 0.08,
      trigger: loc.querySelector(".stat-cards"),
      start: "top 84%",
    });
    statCards.forEach((card) => {
      revealScale(gsap, card.querySelector(".stat-card__number"), { from: 0.9, dur: 0.85, start: "top 86%" });
    });

    const mapFrame = loc.querySelector(".map-block__frame");
    if (mapFrame) {
      gsap.from(mapFrame, {
        y: 36,
        opacity: 0,
        scale: 0.98,
        duration: 1.3,
        ease: "power3.out",
        scrollTrigger: { trigger: mapFrame, start: "top 80%" },
      });
    }
  }

  /* ── EMPREENDIMENTO ────────────────────────────────────── */
  const emp = document.querySelector("#empreendimento");
  if (emp) {
    revealY(gsap, emp.querySelector(".js-section-title"), { y: 36, dur: 1.1, ease: "power3.out", start: "top 78%" });

    revealStagger(gsap, [...emp.querySelectorAll(".feature-bento__card")], {
      y: 28,
      dur: 0.8,
      stagger: 0.07,
      trigger: emp.querySelector(".feature-bento"),
      start: "top 84%",
    });

    const render = emp.querySelector(".render-block");
    if (render) {
      gsap.from(render, {
        y: 40,
        opacity: 0,
        duration: 1.3,
        ease: "power3.out",
        scrollTrigger: { trigger: render, start: "top 82%" },
      });
      gsap.fromTo(
        render.querySelector("img"),
        { scale: 1.06 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: render, start: "top bottom", end: "bottom top", scrub: 0.5 },
        }
      );
    }

    /* Gallery initial items */
    const galleryItems = [...emp.querySelectorAll(".emp-gallery__item:not(.emp-gallery__item--extra)")];
    revealStagger(gsap, galleryItems, {
      y: 20,
      dur: 0.65,
      stagger: 0.04,
      trigger: emp.querySelector(".emp-gallery__grid"),
      start: "top 86%",
    });
    revealY(gsap, emp.querySelector(".gallery-more-btn"), { y: 14, dur: 0.7, start: "top 92%" });
  }

  /* ── LAZER ─────────────────────────────────────────────── */
  const laz = document.querySelector("#lazer");
  if (laz) {
    revealY(gsap, laz.querySelector(".js-section-title"), { y: 36, dur: 1.1, ease: "power3.out", start: "top 78%" });

    laz.querySelectorAll(".lazer-panel").forEach((panel) => {
      gsap.from(panel, {
        y: 44,
        opacity: 0,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: panel, start: "top 86%" },
      });

      revealStagger(gsap, [...panel.querySelectorAll(".lazer-amenity-card")], {
        y: 16,
        dur: 0.55,
        stagger: 0.04,
        trigger: panel,
        start: "top 74%",
      });
    });
  }

  /* ── PLANTAS ───────────────────────────────────────────── */
  const plt = document.querySelector("#plantas");
  if (plt) {
    revealY(gsap, plt.querySelector(".js-section-title"), { y: 36, dur: 1.1, ease: "power3.out", start: "top 78%" });

    plt.querySelectorAll(".planta-showcase").forEach((box) => {
      revealY(gsap, box, { y: 36, dur: 1.0, start: "top 84%" });

      /* Número de área: escala de dentro para fora */
      const areaNum = box.querySelector(".planta-meta__num");
      if (areaNum) {
        gsap.from(areaNum, {
          opacity: 0,
          y: 20,
          duration: 1.1,
          ease: "power3.out",
          scrollTrigger: { trigger: box, start: "top 80%" },
        });
      }

      /* Itens da lista: stagger */
      revealStagger(gsap, [...box.querySelectorAll(".js-planta-item")], {
        y: 12,
        dur: 0.5,
        stagger: 0.09,
        trigger: box,
        start: "top 74%",
      });
    });
  }

  /* ── ASSINATURAS ───────────────────────────────────────── */
  const sig = document.querySelector("#assinaturas");
  if (sig) {
    revealY(gsap, sig.querySelector(".js-section-title"), { y: 36, dur: 1.1, ease: "power3.out", start: "top 78%" });

    sig.querySelectorAll(".sig-brand").forEach((brand, i) => {
      gsap.from(brand, {
        y: 40,
        opacity: 0,
        duration: 1.05,
        delay: i * 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: brand, start: "top 86%" },
      });
      /* Gold rule: animates width from 0 */
      const rule = brand.querySelector(".sig-brand__rule");
      if (rule) {
        gsap.from(rule, {
          scaleX: 0,
          opacity: 0,
          transformOrigin: "left center",
          duration: 1.1,
          ease: "power2.out",
          scrollTrigger: { trigger: brand, start: "top 82%" },
        });
      }
    });

    revealStagger(gsap, [...sig.querySelectorAll(".js-sig-gal")], {
      y: 36,
      dur: 1.1,
      stagger: 0.1,
      trigger: sig.querySelector(".signature-gallery"),
      start: "top 82%",
    });
  }

  /* ── MARLON ────────────────────────────────────────────── */
  const mar = document.querySelector("#marlon");
  if (mar) {
    revealY(gsap, mar.querySelector(".js-section-title"), { y: 36, dur: 1.1, ease: "power3.out", start: "top 78%" });
    revealY(gsap, mar.querySelector(".marlon-media__frame"), { y: 44, dur: 1.3, ease: "power3.out", start: "top 80%" });
    revealY(gsap, mar.querySelector(".js-marlon-quote"), { y: 24, dur: 1.1, start: "top 84%" });
    revealY(gsap, mar.querySelector(".js-marlon-tag"),   { y: 14, dur: 0.85, start: "top 90%" });
    revealY(gsap, mar.querySelector(".marlon-copy .btn"), { y: 14, dur: 0.8, start: "top 92%" });
  }

  /* ── NF / INVESTIMENTO ─────────────────────────────────── */
  const nf = document.querySelector("#investimento");
  if (nf) {
    revealY(gsap, nf.querySelector(".js-section-title"), { y: 36, dur: 1.1, ease: "power3.out", start: "top 78%" });

    const statsEl = nf.querySelector(".nf-stats");
    if (statsEl) {
      revealStagger(gsap, [...statsEl.querySelectorAll(".nf-stat")], {
        y: 32,
        dur: 0.9,
        stagger: 0.09,
        trigger: statsEl,
        start: "top 84%",
      });
      statsEl.querySelectorAll(".nf-stat__value").forEach((val) => {
        revealScale(gsap, val, { from: 0.82, dur: 1.0, start: "top 86%" });
      });
    }

    revealStagger(gsap, [...nf.querySelectorAll(".js-nf-footer")], {
      y: 14,
      dur: 0.8,
      stagger: 0.08,
      trigger: nf.querySelector(".nf-audit") || nf,
      start: "top 86%",
    });
  }

  /* ── FORMULÁRIO ────────────────────────────────────────── */
  const frm = document.querySelector("#contato");
  if (frm) {
    revealY(gsap, frm.querySelector(".js-section-title"), { y: 36, dur: 1.1, ease: "power3.out", start: "top 78%" });

    revealStagger(gsap, [...frm.querySelectorAll(".field, .lead-form__actions")], {
      y: 20,
      dur: 0.7,
      stagger: 0.055,
      trigger: frm.querySelector(".lead-form"),
      start: "top 84%",
    });

    revealY(gsap, frm.querySelector(".js-form-footer"), { y: 10, dur: 0.8, start: "top 93%" });
  }
}
