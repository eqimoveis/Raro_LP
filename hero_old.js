/**
 * Hero ÔÇö v├¡deo puro linkado ao scroll (Apple-style)
 *
 * Smoothing strategy:
 *   ÔÇó Lenis (1.15 s ease) suaviza o scroll ÔÇö fonte ├║nica de easing.
 *   ÔÇó scrub: true mapeia direto, sem lag adicional do GSAP.
 *   ÔÇó Frame blending: interpola visualmente entre frame[N] e frame[N+1]
 *     usando globalAlpha no canvas ÔåÆ transi├º├úo sub-pixel cont├¡nua.
 *   ÔÇó Sem rAF lerp extra (eliminava lag mas adicionava atraso percept├¡vel).
 *
 * Desktop : assets/frames/frame-0001.jpg ÔÇª frame-0241.jpg  ÔÇö playback reverso
 * Mobile  : assets/frames-mobile/frame-0001.jpg ÔÇª frame-0241.jpg ÔÇö playback normal
 */

const FRAME_COUNT = 241;
const FRAME_PAD   = 4;

/* Mobile quando a viewport for menor que 768 px de largura */
const IS_MOBILE = () => window.matchMedia("(max-width: 767px)").matches;

function framePath(i) {
  const dir = IS_MOBILE() ? "assets/frames-mobile" : "assets/frames";
  return `${dir}/frame-${String(i).padStart(FRAME_PAD, "0")}.jpg`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject();
    img.src = src;
  });
}

/* ÔöÇÔöÇ Carregamento em batches ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
async function loadFrames(onBatch) {
  try { await loadImage(framePath(1)); } catch { return false; }

  const BATCH = 20;
  for (let start = 1; start <= FRAME_COUNT; start += BATCH) {
    const end   = Math.min(start + BATCH - 1, FRAME_COUNT);
    const batch = [];
    for (let i = start; i <= end; i++) {
      batch.push(
        loadImage(framePath(i))
          .then(img => { onBatch(i - 1, img); })
          .catch(()  => {})
      );
    }
    await Promise.all(batch);
  }
  return true;
}

/* ÔöÇÔöÇ Nearest-frame fallback (durante carregamento parcial) ÔöÇÔöÇ */
function nearestFrame(images, idx) {
  if (images[idx]) return images[idx];
  for (let d = 1; d < images.length; d++) {
    const lo = idx - d, hi = idx + d;
    if (lo >= 0           && images[lo]) return images[lo];
    if (hi < images.length && images[hi]) return images[hi];
  }
  return null;
}

/* ÔöÇÔöÇ Cover-fit de uma imagem no canvas ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
function drawFrame(ctx, img, w, h) {
  if (!img) return;
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let dw, dh, dx, dy;
  if (ir > cr) { dh = h; dw = h * ir; dx = (w - dw) / 2; dy = 0; }
  else          { dw = w; dh = w / ir; dx = 0; dy = (h - dh) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}

/**
 * Frame blending ÔÇö interpola visualmente entre frame[idx1] e frame[idx2].
 * blend = 0 ÔåÆ apenas idx1 ┬À blend = 1 ÔåÆ apenas idx2
 *
 * Elimina os "degraus" vis├¡veis na transi├º├úo entre frames consecutivos,
 * criando movimento cont├¡nuo sem precisar de mais arquivos.
 */
function drawFrameBlended(ctx, img1, img2, blend, w, h) {
  if (!img1 && !img2) return;
  if (!img1 || blend >= 0.999) { drawFrame(ctx, img2 ?? img1, w, h); return; }
  if (!img2 || blend <= 0.001) { drawFrame(ctx, img1, w, h); return; }

  /* Frame base */
  drawFrame(ctx, img1, w, h);
  /* Overlay do pr├│ximo frame com alpha proporcional ao avan├ºo */
  ctx.save();
  ctx.globalAlpha = blend;
  drawFrame(ctx, img2, w, h);
  ctx.restore();
}

function drawLoadingBar(ctx, w, h, pct) {
  ctx.fillStyle = "#050709";
  ctx.fillRect(0, 0, w, h);
  const bw = Math.round(w * 0.26), bh = 1;
  const bx = Math.round((w - bw) / 2), by = Math.round(h / 2);
  ctx.fillStyle = "rgba(200,150,90,0.10)";
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = "rgba(200,150,90,0.65)";
  ctx.fillRect(bx, by, Math.round(bw * pct), bh);
}

function resizeCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w   = canvas.clientWidth;
  const h   = canvas.clientHeight;
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

/* ÔöÇÔöÇ Entrada principal ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
export function initHero(gsap, ScrollTrigger) {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  let images    = new Array(FRAME_COUNT).fill(null);
  let anyLoaded = false;
  let loadedPct = 0;
  let lastDims  = { w: 0, h: 0 };
  let currentProg = 0;
  let lastMobile  = IS_MOBILE(); /* detecta mudan├ºa de breakpoint no resize */

  /*
   * lastKey: evita repinturas id├¬nticas.
   * Combinamos idx1 e blend (granularidade de 1/1023) numa chave inteira.
   */
  let lastKey = -1;

  function paint(prog) {
    const { w, h } = lastDims;
    if (!w || !h) return;

    if (!anyLoaded) {
      drawLoadingBar(ctx, w, h, loadedPct);
      return;
    }

    /* Desktop: reverso (├║ltimo ÔåÆ primeiro). Mobile: normal (primeiro ÔåÆ ├║ltimo). */
    const exact = IS_MOBILE()
      ? prog * (FRAME_COUNT - 1)
      : (1 - prog) * (FRAME_COUNT - 1);
    const idx1  = Math.floor(exact);
    const idx2  = Math.min(idx1 + 1, FRAME_COUNT - 1);
    const blend = exact - idx1; /* [0, 1) */

    /* Dirty-check: s├│ redesenha se algo mudou */
    const key = idx1 * 1024 + Math.round(blend * 1023);
    if (key === lastKey) return;
    lastKey = key;

    ctx.clearRect(0, 0, w, h);
    drawFrameBlended(
      ctx,
      nearestFrame(images, idx1),
      idx2 !== idx1 ? nearestFrame(images, idx2) : null,
      blend,
      w, h
    );
  }

  function syncSize() {
    lastDims = resizeCanvas(canvas, ctx);
    lastKey  = -1;
    paint(currentProg);
  }

  syncSize();
  window.addEventListener("resize", () => {
    syncSize();
    ScrollTrigger.refresh();
    /* Se o breakpoint mobile/desktop mudou, recarrega os frames corretos */
    const nowMobile = IS_MOBILE();
    if (nowMobile !== lastMobile) {
      lastMobile = nowMobile;
      images    = new Array(FRAME_COUNT).fill(null);
      anyLoaded = false;
      loadedPct = 0;
      loaded    = 0;
      lastKey   = -1;
      startLoad();
    }
  }, { passive: true });

  /* ÔöÇÔöÇ Carregamento de frames ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
  let loaded = 0;

  function startLoad() {
    loadFrames((frameIdx, img) => {
      images[frameIdx] = img;
      anyLoaded = true;
      loaded++;
      loadedPct = loaded / FRAME_COUNT;
      lastKey   = -1;
      paint(currentProg);
    }).then(hasFrames => {
      if (!hasFrames) {
        const { w, h } = lastDims;
        if (w && h) { ctx.fillStyle = "#050709"; ctx.fillRect(0, 0, w, h); }
      }
      ScrollTrigger.refresh();
    });
  }

  startLoad();

  /* ÔöÇÔöÇ ScrollTrigger ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
  ScrollTrigger.create({
    trigger: ".hero",
    start:   "top top",
    /*
     * end: "bottom bottom" ÔåÆ o trigger termina quando o fundo do .hero
     * atinge o fundo da viewport. Isso ocorre exatamente em
     * scroll = hero.height ÔêÆ viewportHeight = spacer.height.
     *
     * ├ë o mesmo instante em que o CSS sticky libera o canvas ÔÇö
     * garantindo que o v├¡deo chegue a progress=1 (├║ltimo frame)
     * ao mesmo tempo em que o elemento destrava e come├ºa a rolar.
     * Com "bottom top" o sticky liberava em ~69% do v├¡deo.
     */
    end:   "bottom bottom",
    scrub: true,
    onUpdate(self) {
      currentProg = self.progress;
      paint(currentProg);
    },
  });

  /* ÔöÇÔöÇ Fade out scroll hint ÔöÇÔöÇ */
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
      }
    });
  }

  return {};
}
