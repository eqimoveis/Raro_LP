/**
 * Hero — scroll-linked frame animation  ·  v4 (DEFINITIVE)
 *
 * Técnica Apple-style: pré-carrega frames WebP → pinta no canvas.
 * Direção: REVERSA — scroll 0% = frame 241 (topo) → scroll 100% = frame 1.
 *
 * ┌────────────────────── Otimizações v4 ───────────────────────┐
 * │ 1. scrub: true — Lenis já suaviza o scroll upstream;        │
 * │    GSAP não adiciona lag extra (sem double-smoothing)        │
 * │ 2. Pool pipeline: workers NÃO aguardam decode() —           │
 * │    download do próximo frame começa imediatamente;           │
 * │    decode ocorre em background em paralelo                   │
 * │ 3. Ordem interleaved binária — garante cobertura uniforme   │
 * │    em poucos frames: após 15 frames carregados, gap máximo  │
 * │    entre frames disponíveis é ≤16. Scroll rápido pro meio   │
 * │    sempre encontra um frame próximo.                         │
 * │ 4. Preload do frame-0241 no HTML — download começa antes    │
 * │    do JS rodar (cache hit quando new Image() é criada)      │
 * │ 5. alpha: false — GPU pula composição de alfa               │
 * │ 6. will-change: transform — canvas em compositing layer     │
 * │ 7. DPR = 1.0 — canvas = CSS pixels                         │
 * │ 8. Mobile: assets/frames-mobile-webp/ (≤767px)             │
 * └─────────────────────────────────────────────────────────────┘
 */

const IS_MOBILE = () => window.matchMedia("(max-width: 767px)").matches;
const FRAME_COUNT = 241;
const FRAME_PAD   = 4;
const POOL_SIZE   = 8;

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

/* ── Carrega imagem. awaitDecode=true apenas para o frame inicial ─ */
function loadImg(src, awaitDecode) {
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (awaitDecode && img.decode) {
        // Frame inicial: aguarda decode completo antes de pintar
        img.decode().then(() => resolve(img)).catch(() => resolve(img));
      } else {
        // Pool: dispara decode em background, libera o worker imediatamente.
        // Quando drawImage() for chamado, a imagem já estará decodificada
        // na maioria dos casos (há tempo entre o load e o scroll do usuário).
        img.decode?.();
        resolve(img);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ── Download pool com concorrência controlada ──────────────── */
async function pool(jobs, onFrame, limit) {
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const j = jobs[cursor++];
      const img = await loadImg(j.src, false);
      if (img) onFrame(j.idx, img);
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(limit, jobs.length); w++) workers.push(worker());
  await Promise.all(workers);
}

/* ── Ordem de carregamento interleaved binário ──────────────── */
// Garante cobertura uniforme: após poucos frames, qualquer ponto
// do scroll encontra um frame carregado próximo.
// Exemplo com 241 frames:
//   Step 128: frame 128
//   Step 64:  frames 64, 192
//   Step 32:  frames 32, 96, 160, 224
//   Step 16:  frames 16, 48, 80, 112, 144, 176, 208, 240
//   → após 15 frames: gap máximo = 16 (em vez de 226 com ordem linear)
function buildInterleaved(count, skip) {
  const visited = new Set([skip]); // frame inicial já carregado
  const order   = [];
  let step = 1;
  while (step < count) step <<= 1; // potência de 2 >= count
  step >>= 1;                       // maior potência de 2 < count

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

  // scrub: true — Lenis já suaviza o scroll; GSAP só espelha o valor
  // do Lenis sem adicionar lag extra. Double-smoothing (scrub numérico
  // + Lenis) causava até 1.5s de atraso em scroll rápido.
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
     LOADING STRATEGY v4
     ─────────────────────────────────────────────────────────
     Fase 1: Frame 241 → cache hit (preloaded no HTML) → instantâneo.
             awaitDecode=true garante bitmap pronto antes do primeiro paint.
     Fase 2: Ordem interleaved binária (ver buildInterleaved).
             8 workers em pipeline: cada worker inicia o próximo
             download imediatamente após onload, sem aguardar decode().
             Decode ocorre em background paralelo aos downloads.
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

    // FASE 2: ordem interleaved — cobertura uniforme imediata
    const idxOrder = buildInterleaved(FRAME_COUNT, FRAME_COUNT - 1);
    const jobs = idxOrder.map(i => ({ idx: i, src: src(i + 1) }));

    await pool(jobs, (idx, img) => {
      frames[idx] = img;
      const t   = 1 - Math.max(0, Math.min(1, progress));
      const cur = Math.round(t * (FRAME_COUNT - 1));
      if (Math.abs(idx - cur) <= 5) {
        lastIdx = -1;
        schedulePaint();
      }
    }, POOL_SIZE);
  })();

  function onRefresh() {
    lastIdx = -1;
    schedulePaint();
  }

  return { onRefresh };
}

/* ═══════════════════════════════════════════════════════════════
   Entry point
   ═══════════════════════════════════════════════════════════════ */
export function initHero(gsap, ScrollTrigger) {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return {};

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const ctx = canvas.getContext("2d", { alpha: false });
    const dir = IS_MOBILE() ? "assets/frames-mobile-webp" : "assets/frames-webp";
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    loadImg(`${dir}/frame-${String(FRAME_COUNT).padStart(FRAME_PAD, "0")}.webp`, true)
      .then(img => { if (img) coverFit(ctx, img, w, h); });
    return {};
  }

  const ctx = canvas.getContext("2d", { alpha: false });

  // Mobile (≤767px): assets/frames-mobile-webp/
  // Desktop (≥768px): assets/frames-webp/
  const dir = IS_MOBILE() ? "assets/frames-mobile-webp" : "assets/frames-webp";

  const { onRefresh } = initFrameScrub(canvas, ctx, gsap, ScrollTrigger, dir);
  return { refreshOnLoaderExit: onRefresh };
}
