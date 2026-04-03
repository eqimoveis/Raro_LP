/**
 * Cards de amenidade (lazer): emite evento para trocar mídia do ator por ambiente.
 * Uso: preencha data-actor-src com URL de GIF/WebP ou use um <video> trocado no listener.
 *
 * document.addEventListener("raro:amenity-focus", (e) => {
 *   const { ambiente, amenity, src, card } = e.detail;
 * });
 */
export function initLeisureAmenityCards() {
  const cards = document.querySelectorAll(".lazer-amenity-card");
  if (!cards.length) return;

  cards.forEach((card) => {
    const activate = () => {
      const panel = card.closest(".lazer-panel");
      panel?.querySelectorAll(".lazer-amenity-card.is-active").forEach((c) => c.classList.remove("is-active"));
      card.classList.add("is-active");

      const ambiente = card.getAttribute("data-ambiente") || "";
      const amenity = card.getAttribute("data-amenity") || "";
      const src = card.getAttribute("data-actor-src") || "";

      document.dispatchEvent(
        new CustomEvent("raro:amenity-focus", {
          bubbles: true,
          detail: { ambiente, amenity, src, card },
        })
      );
    };

    card.addEventListener("click", activate);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });
}
