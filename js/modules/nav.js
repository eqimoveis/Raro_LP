import { ScrollTrigger } from "gsap/ScrollTrigger";

const SECTION_MAP = [
  { id: "empreendimento", nav: "empreendimento" },
  { id: "lazer", nav: "lazer" },
  { id: "plantas", nav: "plantas" },
  { id: "localizacao", nav: "localizacao" },
  { id: "investimento", nav: "investimento" },
];

function getScrollMax() {
  return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

export function initNav() {
  const header = document.querySelector(".site-header");
  const bar = document.querySelector(".scroll-progress__bar");
  const links = document.querySelectorAll(".site-nav__list a[data-nav]");
  const toggle = document.querySelector(".nav-toggle");
  const drawer = document.getElementById("mobile-drawer");

  function setProgress() {
    if (!bar) return;
    const p = window.scrollY / getScrollMax();
    bar.style.width = `${Math.min(100, p * 100)}%`;
  }

  function setHeaderState() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 40);
  }

  function onScroll() {
    setHeaderState();
    setProgress();
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  const lenis = window.__lenis;
  if (lenis && typeof lenis.on === "function") {
    lenis.on("scroll", ({ scroll, limit }) => {
      if (bar && limit) bar.style.width = `${Math.min(100, (scroll / limit) * 100)}%`;
      setHeaderState();
    });
  }

  setHeaderState();
  setProgress();

  SECTION_MAP.forEach((map) => {
    const section = document.getElementById(map.id);
    if (!section) return;

    ScrollTrigger.create({
      trigger: section,
      start: "top 45%",
      end: "bottom 45%",
      onToggle(self) {
        if (!self.isActive) return;
        links.forEach((a) => {
          a.classList.toggle("is-active", a.getAttribute("data-nav") === map.nav);
        });
      },
    });
  });

  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    if (drawer) drawer.hidden = open;
    document.body.style.overflow = open ? "" : "hidden";
  });

  drawer?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      toggle?.setAttribute("aria-expanded", "false");
      if (drawer) drawer.hidden = true;
      document.body.style.overflow = "";
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target || !window.__lenis) return;
      e.preventDefault();
      window.__lenis.scrollTo(target, { offset: -80, duration: 1.2 });
    });
  });
}
