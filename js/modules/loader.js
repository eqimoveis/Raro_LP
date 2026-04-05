export function initLoader(gsap, heroReady) {
  return new Promise((resolve) => {
    const el     = document.getElementById("page-loader");
    const fill   = el?.querySelector(".page-loader__logo--fill");
    const hint   = el?.querySelector(".page-loader__hint");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!el || reduce) {
      el?.remove();
      resolve();
      return;
    }

    document.body.classList.add("is-loading");

    /* ── Logo: reveal esquerda → direita via clip-path ── */
    if (fill) {
      gsap.fromTo(
        fill,
        { clipPath: "inset(0 100% 0 0)" },
        {
          clipPath: "inset(0 0% 0 0)",
          duration: 1.05,
          ease: "power2.inOut",
          delay: 0.12,
        }
      );
    }

    /* ── "Praia Brava" aparece junto ─────────────────── */
    if (hint) {
      gsap.fromTo(
        hint,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.55 }
      );
    }

    /* ── Saída: desliza para cima ────────────────────── */
    const exit = () => {
      gsap.to(el, {
        yPercent: -100,
        duration: 0.9,
        ease: "power4.inOut",
        onComplete: () => {
          el.remove();
          document.body.classList.remove("is-loading");
          resolve();
        },
      });
    };

    /* ── Estratégia de saída ────────────────────────────
       Sai quando AMBAS condições forem cumpridas:
       1. Tempo mínimo da animação do logo (~1.4s)
       2. Hero sinalizou que o lote crítico de frames está pronto

       Timeout de segurança (8s) garante que o loader
       nunca fica preso se algo falhar.
       ──────────────────────────────────────────────────── */
    const minAnimation = new Promise(r => setTimeout(r, 1400));
    const maxTimeout   = new Promise(r => setTimeout(r, 8000));
    const heroSignal   = heroReady || Promise.resolve();

    Promise.race([
      Promise.all([minAnimation, heroSignal]),
      maxTimeout,
    ]).then(() => {
      setTimeout(exit, 180);
    });
  });
}
