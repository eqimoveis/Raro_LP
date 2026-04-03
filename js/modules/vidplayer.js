/**
 * vidplayer.js — player customizado para a seção #filme
 *
 * Fluxo:
 *  1. Usuário vê a thumbnail/poster; clica em big-play → vídeo inicia
 *  2. Controles aparecem no hover / quando pausado
 *  3. Ao terminar: vídeo faz fade-out, end-card com logo aparece
 *  4. "Ver novamente": volta ao início, exibe big-play limpo
 *
 * Mobile fullscreen:
 *  - Play normal → roda o vídeo horizontal inline
 *  - Botão fullscreen → troca para vídeo vertical e abre fullscreen
 *  - Sair do fullscreen → volta ao vídeo horizontal
 */

export function initVidPlayer() {
  const player   = document.getElementById('film-player');
  if (!player) return;

  const video    = document.getElementById('film-video');
  const bigPlay  = document.getElementById('film-big-play');
  const endCard  = document.getElementById('film-end-card');
  const replayBtn= document.getElementById('film-replay');
  const playBtn  = document.getElementById('film-play-btn');
  const muteBtn  = document.getElementById('film-mute-btn');
  const fsBtn    = document.getElementById('film-fs-btn');
  const progBar  = document.getElementById('film-progress-bar');
  const progFill = document.getElementById('film-progress-fill');
  const progThumb= document.getElementById('film-progress-thumb');
  const volSlider= document.getElementById('film-vol-slider');
  const volFill  = document.getElementById('film-vol-fill');
  const currentEl= document.getElementById('film-current');
  const durationEl=document.getElementById('film-duration');

  // ── Ícones play/pause dentro do botão de controle ──────────────────
  const iconPlay  = playBtn.querySelector('.film-ctrl-icon--play');
  const iconPause = playBtn.querySelector('.film-ctrl-icon--pause');
  const iconVol   = muteBtn.querySelector('.film-ctrl-icon--vol');
  const iconMuted = muteBtn.querySelector('.film-ctrl-icon--muted');

  // ── Fontes dos vídeos ─────────────────────────────────────────────
  const SRC_HORIZONTAL = video.getAttribute('src');
  const SRC_VERTICAL   = 'V%C3%ADdeos%20_%20NF%20Raro/V%C3%ADdeos%20Campanha/Vertical/Raro%20Brava%20-%20NF%20-%20Campanha%20-%20vertical.mp4';

  // ── Estado ────────────────────────────────────────────────────────
  let hideControlsTimer = null;
  let verticalActive    = false;  // true enquanto vídeo vertical está carregado
  let pendingFsPlay     = false;  // aguardando canplay para iniciar fullscreen

  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

  // ── Helpers ───────────────────────────────────────────────────────
  function fmt(s) {
    const m = Math.floor(s / 60);
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    return `${m}:${ss}`;
  }

  function setPlayState(playing) {
    player.classList.toggle('is-playing', playing);
    player.classList.toggle('is-paused', !playing);
    iconPlay.hidden  = playing;
    iconPause.hidden = !playing;
    playBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir');
  }

  function setMuteState(muted) {
    iconVol.hidden   = muted;
    iconMuted.hidden = !muted;
    muteBtn.setAttribute('aria-label', muted ? 'Ativar som' : 'Silenciar');
  }

  function updateProgress() {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    progFill.style.width = pct + '%';
    progThumb.style.left  = pct + '%';
    progBar.setAttribute('aria-valuenow', Math.round(pct));
    currentEl.textContent = fmt(video.currentTime);
  }

  function scheduleHideControls() {
    clearTimeout(hideControlsTimer);
    player.classList.add('show-controls');
    hideControlsTimer = setTimeout(() => {
      if (!video.paused) player.classList.remove('show-controls');
    }, 2800);
  }

  // ── Troca de source ───────────────────────────────────────────────
  function switchSrc(src, onReady) {
    video.pause();
    video.src = src;
    video.load();
    video.addEventListener('canplay', onReady, { once: true });
  }

  function restoreHorizontal() {
    verticalActive = false;
    setPlayState(false);
    switchSrc(SRC_HORIZONTAL, () => {
      video.currentTime = 0;
      durationEl.textContent = fmt(video.duration || 0);
    });
  }

  // ── Inicialização de metadados ────────────────────────────────────
  video.addEventListener('loadedmetadata', () => {
    durationEl.textContent = fmt(video.duration);
  });

  // ── Big play: inicia o vídeo ──────────────────────────────────────
  bigPlay.addEventListener('click', () => {
    video.play();
  });

  // Clique no próprio player (fora dos controles) → play/pause toggle
  player.addEventListener('click', (e) => {
    if (
      bigPlay.contains(e.target) ||
      endCard.contains(e.target) ||
      e.target.closest('.film-controls')
    ) return;
    if (video.paused) video.play(); else video.pause();
  });

  // ── Play / Pause ──────────────────────────────────────────────────
  video.addEventListener('play',  () => setPlayState(true));
  video.addEventListener('pause', () => setPlayState(false));

  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (video.paused) video.play(); else video.pause();
  });

  // ── Progresso ────────────────────────────────────────────────────
  video.addEventListener('timeupdate', updateProgress);

  function seekFromEvent(e) {
    const rect = progBar.querySelector('.film-controls__progress-track').getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * video.duration;
  }

  let seeking = false;
  progBar.addEventListener('mousedown', (e) => { seeking = true; seekFromEvent(e); });
  document.addEventListener('mousemove', (e) => { if (seeking) seekFromEvent(e); });
  document.addEventListener('mouseup',   ()  => { seeking = false; });

  progBar.addEventListener('keydown', (e) => {
    const step = video.duration * 0.05;
    if (e.key === 'ArrowRight') video.currentTime = Math.min(video.duration, video.currentTime + step);
    if (e.key === 'ArrowLeft')  video.currentTime = Math.max(0, video.currentTime - step);
  });

  // ── Volume ────────────────────────────────────────────────────────
  function setVolume(v) {
    video.volume = v;
    video.muted  = v === 0;
    volFill.style.width = (v * 100) + '%';
    volSlider.setAttribute('aria-valuenow', Math.round(v * 100));
    setMuteState(video.muted);
  }

  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (video.muted) { video.muted = false; setMuteState(false); }
    else             { video.muted = true;  setMuteState(true);  }
  });

  let draggingVol = false;
  function volFromEvent(e) {
    const rect = volSlider.querySelector('.film-ctrl-vol-track').getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(pct);
  }
  volSlider.addEventListener('mousedown', (e) => { draggingVol = true; volFromEvent(e); });
  document.addEventListener('mousemove', (e) => { if (draggingVol) volFromEvent(e); });
  document.addEventListener('mouseup',   ()  => { draggingVol = false; });

  // ── Fullscreen ────────────────────────────────────────────────────
  function enterFullscreen() {
    // iOS Safari usa webkitEnterFullscreen no elemento <video>
    if (video.webkitEnterFullscreen && !document.fullscreenEnabled) {
      video.webkitEnterFullscreen();
    } else {
      const el = player.requestFullscreen ? player : video;
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  }

  fsBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);

    if (!isFs) {
      if (isMobile() && !verticalActive) {
        // Mobile + ainda no horizontal → troca para vertical antes do fullscreen
        verticalActive = true;
        pendingFsPlay  = true;
        switchSrc(SRC_VERTICAL, () => {
          pendingFsPlay = false;
          video.play().then(() => enterFullscreen()).catch(() => enterFullscreen());
        });
      } else {
        // Desktop ou já está no vertical
        if (!video.paused) {
          enterFullscreen();
        } else {
          video.play().then(() => enterFullscreen()).catch(() => enterFullscreen());
        }
      }
    } else {
      (document.exitFullscreen
        || document.webkitExitFullscreen
        || document.mozCancelFullScreen
      ).call(document);
    }
  });

  // Ao sair do fullscreen em mobile com vídeo vertical → volta ao horizontal
  function onFsChange() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs && verticalActive && isMobile()) {
      restoreHorizontal();
    }
  }
  document.addEventListener('fullscreenchange',       onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  // iOS Safari: saiu do fullscreen nativo do vídeo
  video.addEventListener('webkitendfullscreen', () => {
    if (verticalActive) restoreHorizontal();
  });

  // ── Auto-hide controls ────────────────────────────────────────────
  player.addEventListener('mousemove', scheduleHideControls);
  player.addEventListener('touchstart', scheduleHideControls, { passive: true });

  // ── End: exibe end-card ───────────────────────────────────────────
  video.addEventListener('ended', () => {
    // Se terminou no fullscreen vertical, sai do fullscreen primeiro
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (isFs && verticalActive) {
      (document.exitFullscreen
        || document.webkitExitFullscreen
        || document.mozCancelFullScreen
      ).call(document);
      // onFsChange vai restaurar o horizontal; end-card aparece depois
      return;
    }
    player.classList.add('is-ended');
    endCard.setAttribute('aria-hidden', 'false');
    clearTimeout(hideControlsTimer);
    player.classList.remove('show-controls');
  });

  // ── Replay ────────────────────────────────────────────────────────
  replayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    player.classList.remove('is-ended', 'is-playing', 'is-paused');
    endCard.setAttribute('aria-hidden', 'true');
    video.currentTime = 0;
    video.play();
  });

  // ── Teclado (quando player tem foco) ─────────────────────────────
  player.setAttribute('tabindex', '0');
  player.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      if (video.paused) video.play(); else video.pause();
    }
    if (e.key === 'm') { video.muted = !video.muted; setMuteState(video.muted); }
    if (e.key === 'f') fsBtn.click();
    scheduleHideControls();
  });
}
