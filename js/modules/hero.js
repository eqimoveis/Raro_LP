/**
 * Hero — scroll-linked frame animation  ·  v5 (OPTIMIZED LOAD)
 *
 * Técnica Apple-style: pré-carrega frames WebP → pinta no canvas.
 * Direção: REVERSA — scroll 0% = frame 241 (topo) → scroll 100% = frame 1.
 *
 * ┌────────────────────── Otimizações v5 ───────────────────────┐
 * │ 1. Lote crítico: 20 frames perto do topo com decode COMPLETO│
 * │    → elimina stutter na primeira interação de scroll         │
 * │ 2. readyPromise: sinaliza ao loader quando lote crítico      │
 * │    está pronto → loader sai ANTES de carregar tudo           │
 * │ 3. scrub: true — sem double-smoothing (Lenis + GSAP)        │
 * │ 4. Pool pipeline: download imediato, decode em background    │
 * │ 5. Ordem interleaved binária para restante (gap ≤16)         │
 * │ 6. Preload do frame-0241 no HTML (cache hit)                 │
 * │ 7. alpha: false, DPR = 1.0, will-change: transform          │
 * └─────────────────────────────────────────────────────────────┘
 */

const IS_MOBILE = () => window.matchMedia("(max-width: 767px)").matches;
const FRAME_COUNT    = 241;
const FRAME_PAD      = 4;
const POOL_SIZE      = 8;
const CRITICAL_COUNT = 20;  // frames perto do topo para decode completo

/* ── Cover-fit: preenche canvas inteiro mantendo aspect ratio ─── */
function coverFit(ctx, img, cw, ch) {
  const sw = img.naturalWidth  || img.width;
  const sh = img.naturalHeight || img.height;
  if (!sw || !sh) return;

  const sr = sw / sh;
  const cr = cw / ch;
  let dw, dh, dx, dy;

  if (sr > cr) { dh = ch; dw = ch * sr; dx = (cw - dw) / 2; dy = 0; }
  else         { dw = cw; dh = cw / sr;  dx = 0; dy = (ch - dh) / 2; }

  ctx.drawImage(img, dx, dy, dw, dh);
}

/* ── Carrega imagem. awaitDecode=true → aguarda decode completo ─ */
function loadImg(src, awaitDecode) {
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (awaitDecode && img.decode) {
        img.decode().then(() => resolve(img)).catch(() => resolve(img));
      } else {
        img.decode?.();
        resolve(img);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ── Download pool com concorrência controlada ──────────────── */
async function pool(jobs, onFrame, limit, awaitDecode = false) {
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const j = jobs[cursor++];
      const img = await loadImg(j.src, awaitDecode);
      if (img) onFrame(j.idx, img);
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(limit, jobs.length); w++) workers.push(worker());
  await Promise.all(workers);
}

/* ── Ordem de carregamento interleaved binário ──────────────── */
function buildInterleaved(count, skipSet) {
  const visited = new Set(skipSet);
  const order   = [];
  let step = 1;
  while (step < count) step <<= 1;
  step >>= 1;

  while (step >= 1) {
    for (let i = step - 1; i < count; i += step) {
      if (!visited.has(i)) {
        visited.add(i);
        order.push(i);
      }
    }
    step >>= 1;
  }
  return order;
}

/* ═══════════════════════════════════════════════════════════════
   Motor principal
   ═══════════════════════════════════════════════════════════════ */

function initFrameScrub(canvas, ctx, gsap, ScrollTrigger, frameDir) {
  const frames = new Array(FRAME_COUNT).fill(null);
  let cw = 0;
  let ch = 0;
  let progress  = 0;
  let lastIdx   = -1;
  let raf       = false;
  let ready     = false;

  /* Promise que resolve quando o lote crítico está pronto */
  let resolveReady;
  const readyPromise = new Promise(r => { resolveReady = r; });

  const src = (n) => `${frameDir}/frame-${String(n).padStart(FRAME_PAD, "0")}.webp`;

  /* ── Resize: DPR = 1.0 ─────────────────────────────────── */
  function syncSize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w !== cw || h !== ch) {
      cw = w; ch = h;
      canvas.width  = w;
      canvas.height = h;
      lastIdx = -1;
      schedulePaint();
    }
  }

  /* ── Paint: NUNCA chamado diretamente do scroll ─────────── */
  function paint() {
    raf = false;
    if (!cw || !ch || !ready) return;

    const t   = 1 - Math.max(0, Math.min(1, progress));
    const idx = Math.round(t * (FRAME_COUNT - 1));

    if (idx === lastIdx) return;
    lastIdx = idx;

    const frame = frames[idx] || findNearest(idx);
    if (frame) coverFit(ctx, frame, cw, ch);
  }

  function schedulePaint() {
    if (!raf) { raf = true; requestAnimationFrame(paint); }
  }

  function findNearest(target) {
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (target + d < FRAME_COUNT && frames[target + d]) return frames[target + d];
      if (target - d >= 0          && frames[target - d]) return frames[target - d];
    }
    return null;
  }

  /* ── Setup ──────────────────────────────────────────────── */
  syncSize();
  window.addEventListener("resize", syncSize, { passive: true });

  ScrollTrigger.create({
    trigger: ".hero",
    start:   "top top",
    end:     "bottom bottom",
    scrub:   true,
    onUpdate(self) {
      progress = self.progress;
      schedulePaint();
    },
  });

  const hint = document.getElementById("hero-scroll-hint");
  if (hint) {
    gsap.to(hint, {
      opacity: 0,
      pointerEvents: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "20% top",
        scrub: true,
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════
     LOADING STRATEGY v5
     ─────────────────────────────────────────────────────────
     Fase 1: Frame 241 → cache hit (preloaded no HTML).
             awaitDecode=true → bitmap pronto antes do primeiro paint.

     Fase 1.5: Lote crítico — 20 frames perto do topo (240→221).
               São os primeiros que o usuário verá ao rolar.
               awaitDecode=true → ELIMINA stutter na primeira interação.
               Ao finalizar, sinaliza readyPromise → loader pode sair.

     Fase 2: Restante em ordem interleaved binária.
             awaitDecode=false → download rápido em background.
     ═══════════════════════════════════════════════════════════ */
  (async () => {
    // FASE 1: frame inicial — deve estar em cache pelo preload do HTML
    const first = await loadImg(src(FRAME_COUNT), true);
    if (first) {
      frames[FRAME_COUNT - 1] = first;
      ready = true;
      lastIdx = -1;
      schedulePaint();
    }

    // FASE 1.5: lote crítico — frames perto do topo COM decode completo
    // Frames 240→221 (indices 239→220) = primeiros 20 frames do scroll
    const criticalJobs = [];
    const criticalSet  = new Set([FRAME_COUNT - 1]); // frame 241 já carregado
    for (let i = FRAME_COUNT - 2; i >= Math.max(0, FRAME_COUNT - 1 - CRITICAL_COUNT); i--) {
      criticalJobs.push({ idx: i, src: src(i + 1) });
      criticalSet.add(i);
    }

    await pool(criticalJobs, (idx, img) => {
      frames[idx] = img;
      const t   = 1 - Math.max(0, Math.min(1, progress));
      const cur = Math.round(t * (FRAME_COUNT - 1));
      if (Math.abs(idx - cur) <= 5) {
        lastIdx = -1;
        schedulePaint();
      }
    }, POOL_SIZE, true); // awaitDecode = true ← elimina stutter

    // Lote crítico pronto → loader pode sair
    resolveReady();

    // FASE 2: restante em ordem interleaved (exclui já carregados)
    const remaining = buildInterleaved(FRAME_COUNT, criticalSet);
    const jobs = remaining.map(i => ({ idx: i, src: src(i + 1) }));

    await pool(jobs, (idx, img) => {
      frames[idx] = img;
      const t   = 1 - Math.max(0, Math.min(1, progress));
      const cur = Math.round(t * (FRAME_COUNT - 1));
      if (Math.abs(idx - cur) <= 5) {
        lastIdx = -1;
        schedulePaint();
      }
    }, POOL_SIZE, false); // awaitDecode = false → rápido em background
  })();

  function onRefresh() {
    lastIdx = -1;
    schedulePaint();
  }

  return { onRefresh, readyPromise };
}

/* ═══════════════════════════════════════════════════════════════
   Entry point
   ═══════════════════════════════════════════════════════════════ */
export function initHero(gsap, ScrollTrigger) {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return { readyPromise: Promise.resolve() };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const ctx = canvas.getContext("2d", { alpha: false });
    const dir = IS_MOBILE() ? "assets/frames-mobile-webp" : "assets/frames-webp";
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    loadImg(`${dir}/frame-${String(FRAME_COUNT).padStart(FRAME_PAD, "0")}.webp`, true)
      .then(img => { if (img) coverFit(ctx, img, w, h); });
    return { readyPromise: Promise.resolve() };
  }

  const ctx = canvas.getContext("2d", { alpha: false });

  // Mobile (≤767px): assets/frames-mobile-webp/
  // Desktop (≥768px): assets/frames-webp/
  const dir = IS_MOBILE() ? "assets/frames-mobile-webp" : "assets/frames-webp";

  const { onRefresh, readyPromise } = initFrameScrub(canvas, ctx, gsap, ScrollTrigger, dir);
  return { refreshOnLoaderExit: onRefresh, readyPromise };
}
