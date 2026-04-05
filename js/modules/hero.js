/**
 * Hero — scroll-linked frame animation  ·  DEFINITIVE VERSION
 *
 * Técnica Apple-style: pré-carrega frames WebP → pinta no canvas.
 * Direção: REVERSA — scroll 0% = frame 241 (topo) → scroll 100% = frame 1.
 *
 * ┌────────────────────── Otimizações ──────────────────────┐
 * │ 1. rAF-batched paint   — scroll só atualiza progresso;  │
 * │                         paint roda 1× por frame do      │
 * │                         monitor, NUNCA no scroll handler │
 * │ 2. alpha: false         — GPU pula composição de alfa    │
 * │ 3. DPR = 1.0            — canvas = CSS pixels; imagens  │
 * │                         fonte são resolução fixa, não    │
 * │                         ganham nada com upscaling         │
 * │ 4. new Image + decode() — browser-otimizado, sem fetch/  │
 * │                         blob overhead; decode off-thread │
 * │ 5. Sem loading gate     — primeiro frame aparece instant │
 * │ 6. Snap direto          — 1 drawImage por tick, sem      │
 * │                         blending entre frames            │
 * │ 7. Pool c/ 6 workers    — maximiza HTTP/2 multiplexing   │
 * │ 8. prefers-reduced-motion — respeita preferência a11y    │
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

/* ── Carrega imagem com decode off-thread ───────────────────── */
function loadImg(src, shouldDecode) {
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (shouldDecode && img.decode) {
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
      const img = await loadImg(j.src, false);
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
  let progress  = 0;         // 0 → 1 do ScrollTrigger
  let lastIdx   = -1;        // último frame desenhado
  let raf       = false;     // flag de rAF pendente
  let ready     = false;     // ao menos 1 frame disponível

  const src = (n) => `${frameDir}/frame-${String(n).padStart(FRAME_PAD, "0")}.webp`;

  /* ── Resize: DPR = 1.0 ─────────────────────────────────── */
  function syncSize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w !== cw || h !== ch) {
      cw = w;
      ch = h;
      canvas.width  = w;   // pixel buffer = CSS size (DPR 1.0)
      canvas.height = h;
      lastIdx = -1;         // força repaint após resize
      schedulePaint();
    }
  }

  /* ── Paint: NUNCA chamado diretamente do scroll ─────────── */
  function paint() {
    raf = false;                               // libera flag
    if (!cw || !ch || !ready) return;

    // REVERSE: scroll 0% → frame 241 | scroll 100% → frame 1
    const t   = 1 - Math.max(0, Math.min(1, progress));
    const idx = Math.round(t * (FRAME_COUNT - 1));

    if (idx === lastIdx) return;               // mesmo frame → skip
    lastIdx = idx;

    const frame = frames[idx] || findNearest(idx);
    if (frame) coverFit(ctx, frame, cw, ch);
  }

  /* ── Scheduler: agrupa todos os scrolls em 1 paint/rAF ──── */
  function schedulePaint() {
    if (!raf) {
      raf = true;
      requestAnimationFrame(paint);
    }
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

  // ScrollTrigger: SÓ atualiza variável, nunca pinta
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
     LOADING STRATEGY
     ─────────────────────────────────────────────────────────
     Fase 1: Frame 241 (primeiro visível) → exibe INSTANTANEAMENTE
             Sem loading bar, sem gate, sem espera.
     Fase 2: Frames 240 → 1 (ordem de prioridade reversa)
             Pool com 6 workers, carrega em background.
             Quando um frame perto da posição atual carrega,
             faz repaint automático.
     ═══════════════════════════════════════════════════════════ */
  (async () => {
    // FASE 1: primeiro frame com decode forçado (garante 0 jank no primeiro paint)
    const first = await loadImg(src(FRAME_COUNT), true);
    if (first) {
      frames[FRAME_COUNT - 1] = first;
      ready = true;
      lastIdx = -1;
      schedulePaint();
    }

    // FASE 2: restante 240 → 1
    const jobs = [];
    for (let i = FRAME_COUNT - 1; i >= 1; i--) {
      jobs.push({ idx: i - 1, src: src(i) });
    }

    await pool(jobs, (idx, img) => {
      frames[idx] = img;
      // Se o frame recém-carregado está perto da posição atual, repinta
      const t   = 1 - Math.max(0, Math.min(1, progress));
      const cur = Math.round(t * (FRAME_COUNT - 1));
      if (Math.abs(idx - cur) <= 3) {
        lastIdx = -1;
        schedulePaint();
      }
    }, POOL_SIZE);
  })();
}

/* ═══════════════════════════════════════════════════════════════
   Entry point
   ═══════════════════════════════════════════════════════════════ */
export function initHero(gsap, ScrollTrigger) {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;

  // prefers-reduced-motion: exibe frame estático, sem animação de scroll
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

  // alpha: false = MAJOR GPU optimization (browser pula composição de transparência)
  const ctx = canvas.getContext("2d", { alpha: false });

  const dir  = IS_MOBILE() ? "assets/frames-mobile-webp" : "assets/frames-webp";
  initFrameScrub(canvas, ctx, gsap, ScrollTrigger, dir);
  return {};
}
