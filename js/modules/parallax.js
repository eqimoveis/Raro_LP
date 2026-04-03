export function initParallax(gsap, ScrollTrigger) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  document.querySelectorAll("[data-parallax]").forEach((el) => {
    const subtle = el.getAttribute("data-parallax") === "subtle";
    const y = subtle ? -25 : -50;
    gsap.fromTo(
      el,
      { y: 0 },
      {
        y,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      }
    );
  });

  document.querySelectorAll("[data-parallax-parent]").forEach((parent) => {
    const children = parent.querySelectorAll(".info-card, .signature-gallery__item, .map-block");
    children.forEach((child, i) => {
      gsap.fromTo(
        child,
        { y: 12 * (i % 3) },
        {
          y: -10 * (i % 3),
          ease: "none",
          scrollTrigger: {
            trigger: parent,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    });
  });
}
