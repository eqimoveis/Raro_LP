/**
 * Hero — scroll-linked animation (reverse: último frame → primeiro)
 *
 * Desktop : frame scrubbing (assets/frames-webp/*.webp)
 * Mobile  : frame scrubbing (assets/frames-mobile-webp/*.webp)
 *
 * Ambos usam a mesma técnica: pré-carrega WebP, desenha no canvas.
 * Direção: scroll 0% = frame 241 (topo), scroll 100% = frame 1 (fim).
 */

const IS_MOBILE = () => window.matchMedia("(max-width: 767px)").matches;
const FRAME_COUNT = 241;
const FRAME_PAD = 4;
const READY_THRESHOLD = 50;

/* ─── Cover-fit — desenha imagem cobrindo o canvas inteiro ────────
 * Sem clearRect: cover-fit SEMPRE preenche todos os pixels,
 * então limpar antes é redundante e causava flickering no blend.
 * ──────────────────────────────────────────────────────────────── */
function coverFit(ctx, src, w, h) {
  const sw = src.videoWidth || src.naturalWidth || w;
  const sh = src.videoHeight || src.naturalHeight || h;
  if (!sw || !sh) return;
  const sr = sw / sh, cr = w / h;
  let dw, dh, dx, dy;
  if (sr > cr) { dh = h; dw = h * sr; dx = (w - dw) / 2; dy = 0; }
  else         { dw = w; dh = w / sr; dx = 0; dy = (h - dh) / 2; }
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

/* ─── Shared helpers ──────────────────────────────────────────── */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      img.decode
        ? img.decode().then(() => resolve(img)).catch(() => resolve(img))
        : resolve(img);
    };
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

/* Blend dois frames SEM clearRect intermediário.
 * img1 é desenhado primeiro (opacidade 1), depois img2 por cima (opacidade = blend).
 * Isso elimina o flickering que acontecia quando coverFit limpava o canvas. */
function drawBlended(ctx, img1, img2, blend, w, h) {
  if (!img1 && !img2) return;
  if (!img1 || blend >= 0.999) { coverFit(ctx, img2 ?? img1, w, h); return; }
  if (!img2 || blend <= 0.001) { coverFit(ctx, img1, w, h); return; }
  coverFit(ctx, img1, w, h);
  ctx.save();
  ctx.globalAlpha = blend;
  coverFit(ctx, img2, w, h);
  ctx.restore();
}

/* ─── Paint genérico (usado por desktop e mobile) ────────────── */
function createPainter(ctx, images, getDims) {
  let lastKey = -1;

  function paint(p) {
    const { w, h } = getDims();
    if (!w || !h) return;

    // REVERSE: scroll 0 = último frame, scroll 1 = primeiro frame
    const reversed = 1 - Math.max(0, Math.min(1, p));
    const exact = reversed * (FRAME_COUNT - 1);
    const idx1 = Math.floor(exact);
    const idx2 = Math.min(idx1 + 1, FRAME_COUNT - 1);
    const blend = exact - idx1;
    const key = idx1 * 1024 + Math.round(blend * 1023);
    if (key === lastKey) return;
    lastKey = key;

    drawBlended(ctx, nearestFrame(images, idx1), idx2 !== idx1 ? nearestFrame(images, idx2) : null, blend, w, h);
  }

  paint.resetKey = () => { lastKey = -1; };
  return paint;
}

/* ─── Carregamento com loading gate (reverse-aware) ──────────── */
async function loadFrames(images, framePath, paint, onProgress, onReady, getProgress) {
  // 1. Frame ÚLTIMO primeiro (é o primeiro visível no topo da página)
  const LAST = FRAME_COUNT;
  try {
    const img = await loadImage(framePath(LAST));
    images[LAST - 1] = img;
  } catch (e) { console.warn("Falha frame inicial (último)", e); }

  // 2. Priority: últimos 50 frames (os primeiros visíveis ao rolar)
  const priority = [];
  for (let i = LAST - 1; i >= LAST - READY_THRESHOLD && i >= 1; i--) {
    priority.push(i);
  }

  let done = 1;
  const total = READY_THRESHOLD;
  await Promise.all(priority.map(i =>
    loadImage(framePath(i)).then(img => {
      images[i - 1] = img;
      done++;
      onProgress(done / total);
    }).catch(() => { done++; onProgress(done / total); })
  ));

  // Priority batch completo — libera animação
  onReady();

  // 3. Restante em batches (do fim pro início, ordem de uso)
  const loaded = new Set([LAST, ...priority]);
  const remaining = [];
  for (let i = FRAME_COUNT; i >= 1; i--) {
    if (!loaded.has(i)) remaining.push(i);
  }

  const BATCH = 20;
  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH);
    await Promise.all(batch.map(idx =>
      loadImage(framePath(idx)).then(img => {
        images[idx - 1] = img;
        paint.resetKey();
        paint(getProgress());
      }).catch(() => {})
    ));
  }
}

/* ══════════════════════════════════════════════════════════════════
   DESKTOP — frame scrubbing (WebP)
   ══════════════════════════════════════════════════════════════════ */
function initDesktopFrames(canvas, ctx, gsap, ScrollTrigger) {
  const images = new Array(FRAME_COUNT).fill(null);
  let dims = { w: 0, h: 0 };
  let prog = 0;
  let ready = false;
  let priorityPct = 0;

  const framePath = (i) =>
    `assets/frames-webp/frame-${String(i).padStart(FRAME_PAD, "0")}.webp`;

  const paint = createPainter(ctx, images, () => dims);

  const paintOrLoading = (p) => {
    const { w, h } = dims;
    if (!w || !h) return;
    if (!ready) { drawLoadingBar(ctx, w, h, priorityPct); return; }
    paint(p);
  };

  const syncSize = () => { dims = resizeCanvas(canvas, ctx); paint.resetKey(); paintOrLoading(prog); };
  syncSize();
  window.addEventListener("resize", syncSize, { passive: true });

  ScrollTrigger.create({
    trigger: ".hero", start: "top top", end: "bottom bottom", scrub: true,
    onUpdate(self) { prog = self.progress; paintOrLoading(prog); }
  });

  const hint = document.getElementById("hero-scroll-hint");
  if (hint) {
    gsap.to(hint, {
      opacity: 0, pointerEvents: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "20% top", scrub: true }
    });
  }

  loadFrames(
    images,
    framePath,
    paint,
    (pct) => { priorityPct = pct; paintOrLoading(prog); },
    () => { ready = true; paint.resetKey(); paintOrLoading(prog); },
    () => prog
  );
}

/* ══════════════════════════════════════════════════════════════════
   MOBILE — frame scrubbing (WebP)
   ══════════════════════════════════════════════════════════════════ */
function initMobileFrames(canvas, ctx, gsap, ScrollTrigger) {
  const images = new Array(FRAME_COUNT).fill(null);
  let dims = { w: 0, h: 0 };
  let prog = 0;
  let ready = false;
  let priorityPct = 0;

  const framePath = (i) =>
    `assets/frames-mobile-webp/frame-${String(i).padStart(FRAME_PAD, "0")}.webp`;

  const paint = createPainter(ctx, images, () => dims);

  const paintOrLoading = (p) => {
    const { w, h } = dims;
    if (!w || !h) return;
    if (!ready) { drawLoadingBar(ctx, w, h, priorityPct); return; }
    paint(p);
  };

  const syncSize = () => { dims = resizeCanvas(canvas, ctx); paint.resetKey(); paintOrLoading(prog); };
  syncSize();
  window.addEventListener("resize", syncSize, { passive: true });

  ScrollTrigger.create({
    trigger: ".hero", start: "top top", end: "bottom bottom", scrub: true,
    onUpdate(self) { prog = self.progress; paintOrLoading(prog); }
  });

  const hint = document.getElementById("hero-scroll-hint");
  if (hint) {
    gsap.to(hint, {
      opacity: 0, pointerEvents: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "20% top", scrub: true }
    });
  }

  loadFrames(
    images,
    framePath,
    paint,
    (pct) => { priorityPct = pct; paintOrLoading(prog); },
    () => { ready = true; paint.resetKey(); paintOrLoading(prog); },
    () => prog
  );
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
