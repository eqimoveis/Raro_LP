/**
 * Formulário principal = embed Bitrix em #lead-form (ver index.html).
 * CTAs e botão flutuante usam href="#contato"; o scroll suave fica em nav.js (Lenis).
 * Aqui só reforçamos acessibilidade da região do embed.
 */
export function initForms() {
  const leadForm = document.getElementById("lead-form");
  if (!leadForm) return;

  if (!leadForm.hasAttribute("tabindex")) {
    leadForm.setAttribute("tabindex", "-1");
  }
  leadForm.setAttribute("role", "region");
  leadForm.setAttribute("aria-label", "Formulário de contato — agende sua visita");
}
