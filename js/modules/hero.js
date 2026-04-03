/**
 * Hero — scroll-linked via <video> (Apple-style)
 *
 * Por que vídeo e não JPEG frames?
 *   • 241 JPEGs = 84MB + decode RGBA em RAM (~2GB) → browser trava
 *   • 1 vídeo MP4 = 32MB + hardware decoder + HTTP range requests
 *   • video.currentTime = targetTime → seek nativo, muito mais rápido
 *
 * Desktop : assets/hero_animated/Vídeo_hero_raro.mp4    — playback reverso (1-progress)
 * Mobile  : assets/hero_animated/Video_hero_raro_mobile.mp4 — playback normal (progress)
 */

const IS_MOBILE = () => window.matchMedia("(max-width: 767px)").matches;

/* ── Cover-fit para video e img ─────────────────────────────── */
function drawCover(ctx, source, w, h) {
  // HTMLVideoElement usa videoWidth/videoHeight; HTMLImageElement usa naturalWidth
  const sw = source.videoWidth  ?? source.naturalWidth  ?? source.width;
  const sh = source.videoHeight ?? source.naturalHeight ?? source.height;
  if (!sw || !sh) return;
  const sr = sw / sh, cr = w / h;
  let dw, dh, dx, dy;
  if (sr > cr) { dh = h; dw = h * sr; dx = (w - dw) / 2; dy = 0; }
  else          { dw = w; dh = w / sr; dx = 0;             dy = (h - dh) / 2; }
  ctx.drawImage(source, dx, dy, dw, dh);
}

function drawLoadingBar(ctx, w, h, pct) {
  ctx.fillStyle = "#050709"; ctx.fillRect(0, 0, w, h);
  const bw = Math.round(w * 0.26), bh = 1;
  const bx = Math.round((w - bw) / 2), by = Math.round(h / 2);
  ctx.fillStyle = "rgba(200,150,90,0.10)"; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = "rgba(200,150,90,0.65)"; ctx.fillRect(bx, by, Math.round(bw * pct), bh);
}

function resizeCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

/* ── Entrada principal ─────────────────────────────────────── */
export function initHero(gsap, ScrollTrigger) {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const mobile = IS_MOBILE();

  /* -seekable: re-encodado com g=1 (all-intra) + faststart → seek instantâneo */
  const DESKTOP_SRC = "assets/hero_animated/hero-desktop-seekable.mp4";
  const MOBILE_SRC  = "assets/hero_animated/hero-mobile-seekable.mp4";

  const video = document.createElement("video");
  video.muted       = true;
  video.playsInline = true;
  video.preload     = "auto";
  video.src         = mobile ? MOBILE_SRC : DESKTOP_SRC;

  let lastDims   = { w: 0, h: 0 };
  let scrollProg = 0;
  let isReady    = false;
  let buffered   = 0;   // 0–1: quanto do vídeo foi baixado
  let lastKey    = -1;  // evita redraws idênticos

  /* ── Tempo alvo baseado no scroll ─────────────────────────
   * Desktop reverso : prog=0 → último segundo · prog=1 → segundo 0
   * Mobile normal   : prog=0 → segundo 0      · prog=1 → último segundo
   */
  function targetTime() {
    if (!video.duration) return 0;
    const p = Math.max(0, Math.min(1, scrollProg));
    return mobile ? p * video.duration : (1 - p) * video.duration;
  }

  /* ── Render ─────────────────────────────────────────────── */
  function render() {
    const { w, h } = lastDims;
    if (!w || !h) return;

    if (!isReady) {
      drawLoadingBar(ctx, w, h, buffered);
      return;
    }

    // Dirty-check por tempo (ms granularidade de 1)
    const t = Math.round(video.currentTime * 1000);
    if (t === lastKey) return;
    lastKey = t;

    ctx.clearRect(0, 0, w, h);
    drawCover(ctx, video, w, h);
  }

  /* ── Seek + redraw ──────────────────────────────────────── */
  function seekTo(t) {
    if (!video.duration) return;
    // Só faz seek se a diferença for maior que 1 frame (~33ms a 30fps)
    if (Math.abs(video.currentTime - t) < 0.033) {
      render(); // já está no frame certo, só renderiza
      return;
    }
    video.currentTime = t;
    // render() será chamado pelo evento 'seeked'
  }

  /* ── Eventos do vídeo ───────────────────────────────────── */
  video.addEventListener("loadedmetadata", () => {
    // Metadados carregados: saber a duração. Vai para o frame inicial.
    video.currentTime = targetTime();
  });

  video.addEventListener("loadeddata", () => {
    // Primeiro frame disponível: pode renderizar
    isReady = true;
    lastKey = -1;
    render();
    ScrollTrigger.refresh();
  });

  video.addEventListener("seeked", () => {
    lastKey = -1;
    render();
  });

  video.addEventListener("progress", () => {
    // Atualiza barra de buffer
    if (video.buffered.length && video.duration) {
      buffered = video.buffered.end(video.buffered.length - 1) / video.duration;
      if (!isReady) render(); // mantém barra atualizada
    }
  });

  video.addEventListener("error", () => {
    console.warn("[hero] Falha ao carregar vídeo:", video.src);
  });

  /* ── Canvas sizing ─────────────────────────────────────── */
  function syncSize() {
    lastDims = resizeCanvas(canvas, ctx);
    lastKey  = -1;
    render();
  }

  syncSize();

  window.addEventListener("resize", () => {
    syncSize();
    ScrollTrigger.refresh();
  }, { passive: true });

  /* ── ScrollTrigger ─────────────────────────────────────── */
  ScrollTrigger.create({
    trigger: ".hero",
    start:   "top top",
    end:     "bottom bottom",
    scrub:   true,
    onUpdate(self) {
      scrollProg = self.progress;
      seekTo(targetTime());
    }
  });

  /* ── Scroll hint fade ───────────────────────────────────── */
  const hint = document.getElementById("hero-scroll-hint");
  if (hint) {
    gsap.to(hint, {
      opacity: 0, pointerEvents: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "20% top", scrub: true }
    });
  }

  return {};
}
