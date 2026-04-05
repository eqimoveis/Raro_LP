export function initLoader(gsap) {
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

    const scheduleExit = () => setTimeout(exit, 280);

    if (document.readyState === "complete") {
      scheduleExit();
    } else {
      window.addEventListener("load", scheduleExit, { once: true });
    }
  });
}
