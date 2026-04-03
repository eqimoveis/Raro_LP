/**
 * Hero — scroll-linked animation
 *
 * Desktop : frame scrubbing (assets/frames-webp/*.webp)
 *           Mesmo approach do mobile: pré-carrega WebP, desenha no canvas.
 *           Fluido, sem depender de video.currentTime seeking.
 *
 * Mobile  : frame scrubbing (assets/frames-mobile-webp/*.webp)
 *           WebP = 37% menor que JPG, carrega mais rápido.
 *           Exibe loading bar até 50 frames prontos → animação sempre fluida.
 */

const IS_MOBILE = () => window.matchMedia("(max-width: 767px)").matches;
const FRAME_COUNT = 241;
const FRAME_PAD = 4;
const READY_THRESHOLD = 50;

/* ─── Cover-fit ──────────────────────────────────────────────────── */
function coverFit(ctx, src, w, h) {
  const sw = src.videoWidth || src.naturalWidth || w;
  const sh = src.videoHeight || src.naturalHeight || h;
  if (!sw || !sh) return;
  const sr = sw / sh, cr = w / h;
  let dw, dh, dx, dy;
  if (sr > cr) { dh = h; dw = h * sr; dx = (w - dw) / 2; dy = 0; }
  else { dw = w; dh = w / sr; dx = 0; dy = (h - dh) / 2; }
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, dx, dy, dw, dh);
}

function drawLoadingBar(ctx, w, h, pct) {
  ctx.fillStyle = "#050709";
  ctx.fillRect(0, 0, w, h);
  const bw = Math.round(w * 0.3), bh = 1;
  const bx = Math.round((w - bw) / 2), by = Math.round(h / 2);
  ctx.fillStyle = "rgba(200,150,90,0.10)";
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = "rgba(200,150,90,0.65)";
  ctx.fillRect(bx, by, Math.round(bw * Math.min(pct, 1)), bh);
}

function resizeCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

/* ══════════════════════════════════════════════════════════════════
   DESKTOP — frame scrubbing (WebP) — mesma técnica do mobile
   ══════════════════════════════════════════════════════════════════ */
function initDesktopFrames(canvas, ctx, gsap, ScrollTrigger) {
  const images = new Array(FRAME_COUNT).fill(null);
  let dims = { w: 0, h: 0 };
  let prog = 0;
  let ready = false;
  let priorityPct = 0;
  let lastKey = -1;

  const framePath = (i) =>
    `assets/frames-webp/frame-${String(i).padStart(FRAME_PAD, "0")}.webp`;

  const paint = (p) => {
    const { w, h } = dims;
    if (!w || !h) return;
    if (!ready) { drawLoadingBar(ctx, w, h, priorityPct); return; }

    const exact = Math.max(0, Math.min(1, p)) * (FRAME_COUNT - 1);
    const idx1 = Math.floor(exact), idx2 = Math.min(idx1 + 1, FRAME_COUNT - 1);
    const blend = exact - idx1;
    const key = idx1 * 1024 + Math.round(blend * 1023);
    if (key === lastKey) return;
    lastKey = key;

    ctx.clearRect(0, 0, w, h);
    drawBlended(ctx, nearestFrame(images, idx1), idx2 !== idx1 ? nearestFrame(images, idx2) : null, blend, w, h);
  };

  const syncSize = () => { dims = resizeCanvas(canvas, ctx); lastKey = -1; paint(prog); };
  syncSize();
  window.addEventListener("resize", syncSize, { passive: true });

  ScrollTrigger.create({
    trigger: ".hero", start: "top top", end: "bottom bottom", scrub: true,
    onUpdate(self) { prog = self.progress; paint(prog); }
  });

  const hint = document.getElementById("hero-scroll-hint");
  if (hint) {
    gsap.to(hint, {
      opacity: 0, pointerEvents: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "20% top", scrub: true }
    });
  }

  /* Carregamento com loading gate — idêntico ao mobile */
  async function startLoad() {
    // 1. Frame inicial
    try {
      const img = await loadImage(framePath(1));
      images[0] = img;
    } catch (e) { console.warn("Falha frame inicial desktop", e); }

    // 2. Priority: frames 2-50
    const priority = [];
    for (let i = 2; i <= READY_THRESHOLD; i++) priority.push(i);

    let done = 1;
    await Promise.all(priority.map(i =>
      loadImage(framePath(i)).then(img => {
        images[i - 1] = img;
        done++;
        priorityPct = done / READY_THRESHOLD;
        paint(prog);
      }).catch(() => { done++; priorityPct = done / READY_THRESHOLD; paint(prog); })
    ));

    // Priority batch completo — libera animação
    ready = true;
    lastKey = -1;
    paint(prog);

    // 3. Restante em batches
    const pSet = new Set([1, ...priority]);
    const remaining = [];
    for (let i = 1; i <= FRAME_COUNT; i++) { if (!pSet.has(i)) remaining.push(i); }

    const BATCH = 20;
    for (let i = 0; i < remaining.length; i += BATCH) {
      const batch = remaining.slice(i, i + BATCH);
      await Promise.all(batch.map(idx =>
        loadImage(framePath(idx)).then(img => { images[idx - 1] = img; lastKey = -1; paint(prog); }).catch(() => {})
      ));
    }
  }

  startLoad();
}

/* ══════════════════════════════════════════════════════════════════
   MOBILE — frame scrubbing (WebP)
   ══════════════════════════════════════════════════════════════════ */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { img.decode ? img.decode().then(() => resolve(img)).catch(() => resolve(img)) : resolve(img); };
    img.onerror = () => reject();
    img.src = src;
  });
}

function nearestFrame(images, idx) {
  if (images[idx]) return images[idx];
  for (let d = 1; d < images.length; d++) {
    const lo = idx - d, hi = idx + d;
    if (lo >= 0 && images[lo]) return images[lo];
    if (hi < images.length && images[hi]) return images[hi];
  }
  return null;
}

function drawBlended(ctx, img1, img2, blend, w, h) {
  if (!img1 && !img2) return;
  if (!img1 || blend >= 0.999) { coverFit(ctx, img2 ?? img1, w, h); return; }
  if (!img2 || blend <= 0.001) { coverFit(ctx, img1, w, h); return; }
  coverFit(ctx, img1, w, h);
  ctx.save(); ctx.globalAlpha = blend; coverFit(ctx, img2, w, h); ctx.restore();
}

function initMobileFrames(canvas, ctx, gsap, ScrollTrigger) {
  const images = new Array(FRAME_COUNT).fill(null);
  let dims = { w: 0, h: 0 };
  let prog = 0;
  let ready = false;      // true quando priority batch completo
  let priorityPct = 0;
  let lastKey = -1;

  const framePath = (i) =>
    `assets/frames-mobile-webp/frame-${String(i).padStart(FRAME_PAD, "0")}.webp`;

  const paint = (p) => {
    const { w, h } = dims;
    if (!w || !h) return;
    if (!ready) { drawLoadingBar(ctx, w, h, priorityPct); return; }

    const exact = Math.max(0, Math.min(1, p)) * (FRAME_COUNT - 1);
    const idx1 = Math.floor(exact), idx2 = Math.min(idx1 + 1, FRAME_COUNT - 1);
    const blend = exact - idx1;
    const key = idx1 * 1024 + Math.round(blend * 1023);
    if (key === lastKey) return;
    lastKey = key;

    ctx.clearRect(0, 0, w, h);
    drawBlended(ctx, nearestFrame(images, idx1), idx2 !== idx1 ? nearestFrame(images, idx2) : null, blend, w, h);
  };

  const syncSize = () => { dims = resizeCanvas(canvas, ctx); lastKey = -1; paint(prog); };
  syncSize();
  window.addEventListener("resize", syncSize, { passive: true });

  ScrollTrigger.create({
    trigger: ".hero", start: "top top", end: "bottom bottom", scrub: true,
    onUpdate(self) { prog = self.progress; paint(prog); }
  });

  const hint = document.getElementById("hero-scroll-hint");
  if (hint) {
    gsap.to(hint, {
      opacity: 0, pointerEvents: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "20% top", scrub: true }
    });
  }

  /* Carregamento com loading gate */
  async function startLoad() {
    // 1. Frame inicial (frame 1 para mobile)
    try {
      const img = await loadImage(framePath(1));
      images[0] = img;
    } catch (e) { console.warn("Falha frame inicial mobile", e); }

    // 2. Priority: frames 2-50
    const priority = [];
    for (let i = 2; i <= READY_THRESHOLD; i++) priority.push(i);

    let done = 1;
    await Promise.all(priority.map(i =>
      loadImage(framePath(i)).then(img => {
        images[i - 1] = img;
        done++;
        priorityPct = done / READY_THRESHOLD;
        paint(prog);
      }).catch(() => { done++; priorityPct = done / READY_THRESHOLD; paint(prog); })
    ));

    // Priority batch completo — libera animação
    ready = true;
    lastKey = -1;
    paint(prog);

    // 3. Restante em batches
    const pSet = new Set([1, ...priority]);
    const remaining = [];
    for (let i = 1; i <= FRAME_COUNT; i++) { if (!pSet.has(i)) remaining.push(i); }

    const BATCH = 20;
    for (let i = 0; i < remaining.length; i += BATCH) {
      const batch = remaining.slice(i, i + BATCH);
      await Promise.all(batch.map(idx =>
        loadImage(framePath(idx)).then(img => { images[idx - 1] = img; lastKey = -1; paint(prog); }).catch(() => {})
      ));
    }
  }

  startLoad();
}

/* ══════════════════════════════════════════════════════════════════
   ENTRY POINT
   ══════════════════════════════════════════════════════════════════ */
export function initHero(gsap, ScrollTrigger) {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (IS_MOBILE()) {
    initMobileFrames(canvas, ctx, gsap, ScrollTrigger);
  } else {
    initDesktopFrames(canvas, ctx, gsap, ScrollTrigger);
  }

  return {};
}
