/**
 * Hero — scroll-linked frame animation  ·  v3
 *
 * Técnica Apple-style: pré-carrega frames WebP → pinta no canvas.
 * Direção: REVERSA — scroll 0% = frame 241 (topo) → scroll 100% = frame 1.
 *
 * ┌────────────────────── Otimizações ──────────────────────┐
 * │ 1. img.decode() em TODOS os frames — move decodificação  │
 * │    para fora do critical path, evita jank no main thread │
 * │ 2. scrub: 0.5 — interpolação suave em 120Hz sem latência │
 * │    perceptível (Lenis já suaviza o scroll upstream)      │
 * │ 3. refreshOnLoaderExit — hook para main.js acionar       │
 * │    ScrollTrigger.refresh() pós-loader com layout correto │
 * │ 4. alpha: false — GPU pula composição de alfa            │
 * │ 5. DPR = 1.0 — canvas = CSS pixels                      │
 * │ 6. Pool c/ 6 workers — maximiza HTTP/2 multiplexing      │
 * │ 7. Mobile: assets/frames-mobile-webp/ (detectado por     │
 * │    matchMedia ≤767px no momento da inicialização)        │
 * └─────────────────────────────────────────────────────────┘
 */

const IS_MOBILE = () => window.matchMedia("(max-width: 767px)").matches;
const FRAME_COUNT = 241;
const FRAME_PAD   = 4;
const POOL_SIZE   = 6;

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

/* ── Carrega imagem com decode sempre off-thread ────────────── */
function loadImg(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // img.decode() chamado em TODOS os frames (não apenas o primeiro).
      // Move a decodificação para fora do rendering pipeline — o browser
      // faz isso em paralelo com outros trabalhos, evitando stutter.
      if (img.decode) {
        img.decode().then(() => resolve(img)).catch(() => resolve(img));
      } else {
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
      const img = await loadImg(j.src);
      if (img) onFrame(j.idx, img);
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(limit, jobs.length); w++) workers.push(worker());
  await Promise.all(workers);
}

/* ═══════════════════════════════════════════════════════════════
   Motor principal
   ═══════════════════════════════════════════════════════════════ */

function initFrameScrub(canvas, ctx, gsap, ScrollTrigger, frameDir) {
  const frames = new Array(FRAME_COUNT).fill(null);
  let cw = 0;
  let ch = 0;
  let progress  = 0;    // 0 → 1 do ScrollTrigger
  let lastIdx   = -1;   // último frame desenhado
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

    // REVERSE: scroll 0% → frame 241 | scroll 100% → frame 1
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

  /* ── Busca frame carregado mais próximo ─────────────────── */
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

  // scrub: 0.5 — interpolação de 500ms entre o scroll do Lenis e o progresso
  // reportado pelo trigger. Com Lenis já suavizando o scroll upstream, isso
  // elimina micro-jank visível em monitores 120Hz sem latência perceptível.
  ScrollTrigger.create({
    trigger: ".hero",
    start:   "top top",
    end:     "bottom bottom",
    scrub:   0.5,
    onUpdate(self) {
      progress = self.progress;
      schedulePaint();
    },
  });

  // Fade do scroll hint
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
     LOADING STRATEGY v3
     ─────────────────────────────────────────────────────────
     Fase 1: Frame 241 (primeiro visível) → exibe INSTANTANEAMENTE.
             decode() forçado garante 0 jank no primeiro paint.
     Fase 2: Frames 240 → 1 em ordem reversa (alta prioridade para
             frames próximos do topo, onde o usuário começa).
             Pool de 6 workers + decode() em cada frame.
             Repaint automático quando frame próximo à posição atual carrega.
     ═══════════════════════════════════════════════════════════ */
  (async () => {
    // FASE 1: frame inicial — exibe assim que possível
    const first = await loadImg(src(FRAME_COUNT));
    if (first) {
      frames[FRAME_COUNT - 1] = first;
      ready = true;
      lastIdx = -1;
      schedulePaint();
    }

    // FASE 2: 240 → 1 (prioridade para frames do início da animação)
    const jobs = [];
    for (let i = FRAME_COUNT - 1; i >= 1; i--) {
      jobs.push({ idx: i - 1, src: src(i) });
    }

    await pool(jobs, (idx, img) => {
      frames[idx] = img;
      // Repinta se o frame recém-carregado está próximo da posição atual
      const t   = 1 - Math.max(0, Math.min(1, progress));
      const cur = Math.round(t * (FRAME_COUNT - 1));
      if (Math.abs(idx - cur) <= 3) {
        lastIdx = -1;
        schedulePaint();
      }
    }, POOL_SIZE);
  })();

  /* ── Hook para refresh pós-loader ───────────────────────── */
  // Chamado pelo main.js depois de ScrollTrigger.refresh() pós-loader.
  // Força repaint para usar as posições corretas do trigger recalculado.
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

  // prefers-reduced-motion: exibe frame estático, sem animação de scroll
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const ctx = canvas.getContext("2d", { alpha: false });
    // Mobile: frames-mobile-webp/ | Desktop: frames-webp/
    const dir = IS_MOBILE() ? "assets/frames-mobile-webp" : "assets/frames-webp";
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    loadImg(`${dir}/frame-${String(FRAME_COUNT).padStart(FRAME_PAD, "0")}.webp`)
      .then(img => { if (img) coverFit(ctx, img, w, h); });
    return {};
  }

  const ctx = canvas.getContext("2d", { alpha: false });

  // Mobile (≤767px): assets/frames-mobile-webp/
  // Desktop (≥768px): assets/frames-webp/
  const dir = IS_MOBILE() ? "assets/frames-mobile-webp" : "assets/frames-webp";

  const { onRefresh } = initFrameScrub(canvas, ctx, gsap, ScrollTrigger, dir);

  // refreshOnLoaderExit: chamado pelo main.js após ScrollTrigger.refresh()
  // pós-loader para garantir que o primeiro paint usa posições corretas.
  return { refreshOnLoaderExit: onRefresh };
}
