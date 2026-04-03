export function initTabs(gsap) {
  const root = document.querySelector("[data-tabs]");
  if (!root) return;

  const tabs = root.querySelectorAll(".plantas__tab");
  const panels = root.querySelectorAll(".plantas__panel");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.getAttribute("data-tab");
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
      });

      panels.forEach((panel) => {
        const match = panel.getAttribute("data-panel") === id;
        const wasHidden = panel.hidden;
        panel.classList.toggle("is-active", match);
        panel.hidden = !match;

        if (match && !reduce && wasHidden) {
          gsap.fromTo(
            panel,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }
          );
          const vis = panel.querySelector(".planta-showcase__visual");
          if (vis) {
            gsap.fromTo(vis, { scale: 0.97 }, { scale: 1, duration: 0.65, ease: "power3.out" });
          }
        }
      });
    });
  });
}
