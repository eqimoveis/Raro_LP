/**
 * Planta Zoom — Lightbox elegante para detalhes das plantas
 */
export function initPlantaZoom() {
  const zoomEl = document.getElementById("planta-zoom");
  if (!zoomEl) return;

  const zoomImg = document.getElementById("planta-zoom-img");
  const zoomCaption = document.getElementById("planta-zoom-caption");
  const closeBtn  = zoomEl.querySelector(".planta-zoom__close");
  const overlay   = zoomEl.querySelector(".planta-zoom__overlay");

  // Gatilhos: todas as imagens dentro do grid de plantas
  const triggers = document.querySelectorAll(".planta-showcase__visual img");

  /**
   * Abre o lightbox com os dados da planta
   */
  function openZoom(src, title) {
    if (!zoomImg || !zoomCaption) return;

    zoomImg.src = src;
    zoomCaption.textContent = title;
    
    zoomEl.hidden = false;
    document.body.style.overflow = "hidden"; // trava scroll do fundo
    
    // Foca no botão de fechar para acessibilidade
    setTimeout(() => closeBtn?.focus(), 50);
  }

  /**
   * Fecha o lightbox
   */
  function closeZoom() {
    zoomEl.hidden = true;
    document.body.style.overflow = "";
  }

  // Event Listeners para abertura
  triggers.forEach(img => {
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      const src = img.src;
      
      // Busca o nome técnico da planta na aba ativa
      // Estrutura esperada: "Tipo 2 — Variação <span>...</span>"
      // Pegamos apenas o primeiro nó de texto antes do span
      const activeTab = document.querySelector(".plantas__tab.is-active");
      let title = "";
      
      if (activeTab) {
        // node[0] para pegar "Tipo X" e ignorar o detalhe no span se desejar, 
        // ou pegar o texto inteiro do botão. O usuário pediu "esse nome daí de ID".
        title = activeTab.childNodes[0].textContent.replace("—", "").trim();
      } else {
        title = img.alt || "Planta RARO";
      }

      openZoom(src, title);
    });
  });

  // Fechamento
  closeBtn?.addEventListener("click", closeZoom);
  overlay?.addEventListener("click", closeZoom);

  // Tecla ESC para fechar
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !zoomEl.hidden) {
      closeZoom();
    }
  });
}
