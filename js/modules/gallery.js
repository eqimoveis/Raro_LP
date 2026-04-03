/**
 * Gallery expand — emp-gallery
 * Single stacked card triggers expansion on both mobile and desktop.
 * Mobile (2-col):  5 items + stacked card = 6 cells (3×2 grid)
 * Desktop (4-col): 5 + 2 dt-only + stacked card = 8 cells (2×4 grid)
 */
export function initGallery(gsap) {
  const grid      = document.getElementById("emp-gallery-grid");
  const stackCard = document.getElementById("emp-stack-card");

  if (!grid || !stackCard) return;

  const reduce   = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.innerWidth < 768;

  /* Set count label dynamically based on hidden items */
  function updateCount() {
    const countEl = stackCard.querySelector(".emp-gallery__stack-count");
    if (!countEl) return;
    const extraCount = grid.querySelectorAll(".emp-gallery__item--extra").length;
    const dtOnlyCount = grid.querySelectorAll(".emp-gallery__item--dt-only").length;
    const hiddenCount = extraCount + (isMobile() ? dtOnlyCount : 0);
    countEl.textContent = `+${hiddenCount}`;
  }
  updateCount();
  window.addEventListener("resize", updateCount, { passive: true });

  function expand() {
    if (grid.classList.contains("is-expanded")) return;

    grid.classList.add("is-expanded");

    /* Items that were hidden and now become visible */
    const revealed = [
      ...grid.querySelectorAll(".emp-gallery__item--extra"),
      /* dt-only items are already visible on desktop; on mobile they were hidden */
      ...(isMobile() ? grid.querySelectorAll(".emp-gallery__item--dt-only") : []),
    ];

    /* Stacked card hides via CSS (.is-expanded .stack-card { display:none }),
       but force it immediately so the grid re-flows cleanly */
    stackCard.style.display = "none";

    if (!reduce && gsap && revealed.length) {
      gsap.from(revealed, {
        opacity: 0,
        scale: 0.93,
        y: 18,
        stagger: 0.055,
        duration: 0.55,
        ease: "power2.out",
        clearProps: "transform,opacity",
      });
    }
  }

  stackCard.addEventListener("click", expand);
  stackCard.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      expand();
    }
  });

  /* ── GALLERY ZOOM (LIGHTBOX SLIDER) ────────────────────────── */
  const zoomModal = document.getElementById("gallery-zoom");
  const zoomImg   = document.getElementById("gallery-zoom-img");
  const zoomCount = document.getElementById("gallery-counter");
  const btnPrev   = document.getElementById("gallery-prev");
  const btnNext   = document.getElementById("gallery-next");
  const btnClose  = zoomModal?.querySelector(".gallery-zoom__close");

  if (!zoomModal || !zoomImg) return;

  let currentIndex = 0;
  let allImages = [];

  function updateGalleryData() {
    allImages = Array.from(grid.querySelectorAll(".emp-gallery__item:not(.emp-gallery__stack-card) img"))
      .map(img => ({
        src: img.getAttribute("src"),
        alt: img.getAttribute("alt") || "RARO Praia Brava"
      }));
  }

  function openZoom(index) {
    updateGalleryData();
    currentIndex = index;
    renderZoom();
    zoomModal.hidden = false;
    document.body.style.overflow = "hidden"; // Lock scroll
  }

  function closeZoom() {
    zoomModal.hidden = true;
    document.body.style.overflow = "";
  }

  function renderZoom() {
    if (!allImages[currentIndex]) return;
    zoomImg.src = allImages[currentIndex].src;
    zoomImg.alt = allImages[currentIndex].alt;
    zoomCount.textContent = `${currentIndex + 1} / ${allImages.length}`;
  }

  function next() {
    currentIndex = (currentIndex + 1) % allImages.length;
    renderZoom();
  }

  function prev() {
    currentIndex = (currentIndex - 1 + allImages.length) % allImages.length;
    renderZoom();
  }

  /* Event Delegation for gallery items */
  grid.addEventListener("click", (e) => {
    const item = e.target.closest(".emp-gallery__item");
    if (!item || item.classList.contains("emp-gallery__stack-card")) return;

    // Get index of this item among non-stack-card items
    const allItems = Array.from(grid.querySelectorAll(".emp-gallery__item:not(.emp-gallery__stack-card)"));
    const idx = allItems.indexOf(item);
    if (idx !== -1) openZoom(idx);
  });

  btnNext?.addEventListener("click", (e) => { e.stopPropagation(); next(); });
  btnPrev?.addEventListener("click", (e) => { e.stopPropagation(); prev(); });
  btnClose?.addEventListener("click", closeZoom);
  zoomModal.addEventListener("click", (e) => { if (e.target === zoomModal || e.target.classList.contains("gallery-zoom__overlay")) closeZoom(); });

  /* Keyboard Navigation */
  window.addEventListener("keydown", (e) => {
    if (zoomModal.hidden) return;
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft")  prev();
    if (e.key === "Escape")     closeZoom();
  });

  /* ── TOUCH NAVIGATION (SWIPE) ────────────────────────────── */
  let touchStartX = 0;
  let touchEndX   = 0;

  zoomModal.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  zoomModal.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;
    const threshold = 60; // Sensibilidade do swipe

    if (Math.abs(diff) > threshold) {
      if (diff > 0) prev(); // Deslizar para a direita -> anterior
      else next();          // Deslizar para a esquerda -> próxima
    }
  }, { passive: true });
}
