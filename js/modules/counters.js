function formatValue(current, prefix = "", suffix = "", decimals = 0) {
  const n = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toString();
  return `${prefix}${n}${suffix}`;
}

export function initCounters(gsap, ScrollTrigger) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const els = document.querySelectorAll("[data-counter]");

  els.forEach((el) => {
    const target = Number(el.getAttribute("data-target")) || 0;
    const prefix = el.getAttribute("data-prefix") || "";
    const suffix = el.getAttribute("data-suffix") || "";
    const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);

    if (reduceMotion) {
      el.textContent = formatValue(target, prefix, suffix, decimals);
      return;
    }

    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 2.2,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el.closest("[data-counters]") || el,
        start: "top 82%",
        toggleActions: "play none none none",
      },
      onUpdate: () => {
        el.textContent = formatValue(obj.val, prefix, suffix, decimals);
      },
    });
  });
}
