function getWaBase() {
  const phone = document.body.getAttribute("data-whatsapp-phone") || "";
  const msg = document.body.getAttribute("data-whatsapp-message") || "";
  const text = encodeURIComponent(msg);
  return `https://wa.me/${phone}?text=${text}`;
}

function openWhatsApp(extraLine = "") {
  const base = getWaBase();
  if (!extraLine) {
    window.open(base, "_blank", "noopener,noreferrer");
    return;
  }
  const phone = document.body.getAttribute("data-whatsapp-phone") || "";
  const msg = document.body.getAttribute("data-whatsapp-message") || "";
  const full = encodeURIComponent(`${msg}\n\n${extraLine}`);
  window.open(`https://wa.me/${phone}?text=${full}`, "_blank", "noopener,noreferrer");
}

function bindWaLinks() {
  document.querySelectorAll("[data-wa]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openWhatsApp();
    });
  });
}

function initToggleButtons() {
  const toggleGroup = document.getElementById("investe-toggle");
  if (!toggleGroup) return;

  const btnSim = toggleGroup.querySelector('[data-value="Sim"]');
  const btnNao = toggleGroup.querySelector('[data-value="Não"]');
  const hiddenInput = document.getElementById("ja_investe_val");

  const setActive = (val) => {
    hiddenInput.value = val;
    btnSim.classList.toggle("is-active", val === "Sim");
    btnNao.classList.toggle("is-active", val === "Não");
  };

  btnSim.addEventListener("click", () => setActive("Sim"));
  btnNao.addEventListener("click", () => setActive("Não"));
}

export function initForms() {
  bindWaLinks();
  initToggleButtons();

  const form = document.getElementById("lead-form");
  form?.addEventListener("submit", (e) => e.preventDefault());
  const status = document.getElementById("form-status");
  const submitWa = form?.querySelector("[data-wa-submit]");
  const schedule = form?.querySelector("[data-schedule]");

  submitWa?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!form || !status) return;

    const fd = new FormData(form);
    const nome = String(fd.get("nome") || "").trim();
    const telefone = String(fd.get("telefone") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const jaInveste = String(fd.get("ja_investe") || "").trim();

    if (!nome || !telefone || !email) {
      status.textContent = "Preencha nome, telefone e e-mail para continuar.";
      return;
    }

    status.textContent = "";
    const lines = [
      `Nome: ${nome}`,
      `Telefone: ${telefone}`,
      `E-mail: ${email}`,
      `Já investe em imóveis: ${jaInveste || "Não informado"}`
    ];
    openWhatsApp(lines.join("\n"));
  });

  schedule?.addEventListener("click", (e) => {
    e.preventDefault();
    const subject = encodeURIComponent("Visita presencial — RARO Praia Brava");
    const body = encodeURIComponent(
      "Olá, gostaria de agendar visita presencial ao RARO Praia Brava.\n\nNome:\nTelefone:\nMelhor horário:"
    );
    window.location.href = `mailto:contato@nfempreendimentos.com.br?subject=${subject}&body=${body}`;
  });
}
