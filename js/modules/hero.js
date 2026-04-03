/**
 * Hero — scroll-linked frame animation (Apple-style)
 *
 * Técnica: pré-carrega frames WebP → desenha no canvas via scroll.
 * Direção: REVERSA — scroll 0% = frame 241 (topo), scroll 100% = frame 1.
 *
 * Otimizações-chave:
 *  1. createImageBitmap — decodifica frames FORA da main thread (sem jank)
 *  2. Snap to nearest — sem blending entre frames (1 drawImage por tick)
 *  3. Concorrência controlada — máx 4 downloads simultâneos (sem congestão)
 *  4. DPR limitado a 1.5 — canvas menor = draw mais rápido
 *  5. Sem clearRect — cover-fit cobre 100% dos pixels, limpar é redundante
 */

const IS_MOBILE = () => window.matchMedia("(max-width: 767px)").matches;
const FRAME_COUNT = 241;
const FRAME_PAD   = 4;

/* Quantos frames carregar antes de liberar a animação.
 * Mais = mais espera, menos chance de frame vazio durante scroll rápido. */
const GATE_DESKTOP = 80;
const GATE_MOBILE  = 60;

/* Máx downloads paralelos — respeita o limite de ~6 conn/domínio */
const CONCURRENCY  = 4;

/* ═══════════════════════════════════════════════════════════════
   Helpers de desenho
   ═══════════════════════════════════════════════════════════════ */

/** Cover-fit: preenche o canvas inteiro, sem clearRect. */
function coverFit(ctx, src, cw, ch) {
  const sw = src.width  || src.naturalWidth  || cw;
  const sh = src.height || src.naturalHeight || ch;
  if (!sw || !sh) return;
  const sr = sw / sh, cr = cw / ch;
  let dw, dh, dx, dy;
  if (sr > cr) { dh = ch; dw = ch * sr; dx = (cw - dw) / 2; dy = 0; }
  else         { dw = cw; dh = cw / sr;  dx = 0; dy = (ch - dh) / 2; }
  ctx.drawImage(src, dx, dy, dw, dh);
}

/** Barra de progresso minimalista durante carregamento. */
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

/** Redimensiona canvas com DPR limitado (1.5 max para performance). */
function resizeCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

/* ═══════════════════════════════════════════════════════════════
   Carregamento de imagens — off-thread via createImageBitmap
   ═══════════════════════════════════════════════════════════════ */

/**
 * Carrega uma imagem e retorna um ImageBitmap (decodificado off-thread).
 * Fallback para Image() em browsers sem createImageBitmap.
 */
function loadFrame(src) {
  if (typeof createImageBitmap === "function") {
    return fetch(src)
      .then(r => { if (!r.ok) throw 0; return r.blob(); })
      .then(blob => createImageBitmap(blob))
      .catch(() => null);
  }
  /* fallback — decodifica na main thread */
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Pool de download com concorrência limitada.
 * Evita explodir as conexões do browser (máx ~6 por domínio).
 *
 * @param {Array<{idx:number, src:string}>} jobs
 * @param {Function} onFrame  (idx, bitmap) → void
 * @param {number} limit
 */
async function downloadPool(jobs, onFrame, limit = CONCURRENCY) {
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const job = jobs[i++];
      const bmp = await loadFrame(job.src);
      if (bmp) onFrame(job.idx, bmp);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
}

/* ═══════════════════════════════════════════════════════════════
   Motor principal — usado por desktop e mobile
   ═══════════════════════════════════════════════════════════════ */

function initFrameScrub(canvas, ctx, gsap, ScrollTrigger, frameDir, gate) {
  const frames = new Array(FRAME_COUNT).fill(null);
  let dims     = { w: 0, h: 0 };
  let progress = 0;
  let ready    = false;
  let loadPct  = 0;
  let lastIdx  = -1;

  const src = (i) => `${frameDir}/frame-${String(i).padStart(FRAME_PAD, "0")}.webp`;

  /* ── Paint ────────────────────────────────────────────────── */
  function paint() {
    const { w, h } = dims;
    if (!w || !h) return;

    if (!ready) {
      drawLoadingBar(ctx, w, h, loadPct);
      return;
    }

    // REVERSE: scroll 0 → frame 241, scroll 1 → frame 1
    const p   = 1 - Math.max(0, Math.min(1, progress));
    const idx = Math.round(p * (FRAME_COUNT - 1));

    if (idx === lastIdx) return;          // mesmo frame, pula
    lastIdx = idx;

    // Busca frame exato ou o mais próximo carregado
    const frame = frames[idx] || nearest(idx);
    if (frame) coverFit(ctx, frame, w, h);
  }

  /** Encontra o frame carregado mais próximo de idx. */
  function nearest(idx) {
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (idx + d < FRAME_COUNT && frames[idx + d]) return frames[idx + d];
      if (idx - d >= 0          && frames[idx - d]) return frames[idx - d];
    }
    return null;
  }

  /* ── Canvas resize ────────────────────────────────────────── */
  const syncSize = () => { dims = resizeCanvas(canvas, ctx); lastIdx = -1; paint(); };
  syncSize();
  window.addEventListener("resize", syncSize, { passive: true });

  /* ── ScrollTrigger ────────────────────────────────────────── */
  ScrollTrigger.create({
    trigger: ".hero",
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate(self) { progress = self.progress; paint(); },
  });

  /* ── Hint fade ────────────────────────────────────────────── */
  const hint = document.getElementById("hero-scroll-hint");
  if (hint) {
    gsap.to(hint, {
      opacity: 0, pointerEvents: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "20% top", scrub: true },
    });
  }

  /* ── Carregamento progressivo ─────────────────────────────── */
  (async function load() {
    /*
     * Ordem: como a animação é reversa (topo = frame 241),
     * carregamos do frame 241 para trás.
     */
    const order = [];
    for (let i = FRAME_COUNT; i >= 1; i--) order.push(i);

    /* ── Fase 1: priority batch (gate frames) ──────────────── */
    const priority = order.slice(0, gate);
    let done = 0;

    await downloadPool(
      priority.map(i => ({ idx: i - 1, src: src(i) })),
      (idx, bmp) => {
        frames[idx] = bmp;
        done++;
        loadPct = done / gate;
        paint();                           // atualiza barra
      },
      CONCURRENCY
    );

    // Libera animação
    ready   = true;
    lastIdx = -1;
    paint();

    /* ── Fase 2: restante em background ────────────────────── */
    const rest = order.slice(gate);
    if (!rest.length) return;

    await downloadPool(
      rest.map(i => ({ idx: i - 1, src: src(i) })),
      (idx, bmp) => {
        frames[idx] = bmp;
        // repinta se o usuário está perto desse frame
        const p   = 1 - Math.max(0, Math.min(1, progress));
        const cur = Math.round(p * (FRAME_COUNT - 1));
        if (Math.abs(cur - idx) < 3) { lastIdx = -1; paint(); }
      },
      CONCURRENCY
    );
  })();
}

/* ═══════════════════════════════════════════════════════════════
   Entry point
   ═══════════════════════════════════════════════════════════════ */
export function initHero(gsap, ScrollTrigger) {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const dir  = IS_MOBILE() ? "assets/frames-mobile-webp" : "assets/frames-webp";
  const gate = IS_MOBILE() ? GATE_MOBILE : GATE_DESKTOP;

  initFrameScrub(canvas, ctx, gsap, ScrollTrigger, dir, gate);
  return {};
}
