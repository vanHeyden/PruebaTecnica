(function () {
  const checkout = window.__KUSHKI_CHECKOUT__;
  const form = document.getElementById("payment-form");
  const submitBtn = document.getElementById("pay-button");
  const resultEl = document.getElementById("live-result");

  const kushki = new Kushki({
    merchantId: checkout.publicMerchantId,
    inTestEnvironment: checkout.inTestEnvironment,
  });

  function showResult(payload) {
    const approved = Boolean(payload.approved);
    resultEl.hidden = false;
    resultEl.classList.toggle("is-approved", approved);
    resultEl.classList.toggle("is-declined", !approved);
    document.getElementById("result-title").textContent = approved
      ? "Transacción aprobada"
      : "Transacción declinada";
    document.getElementById("result-message").textContent = payload.message || "";
    document.getElementById("field-status").textContent = payload.status || (approved ? "APPROVED" : "DECLINED");
    document.getElementById("field-status").className = approved ? "status-ok" : "status-no";
    document.getElementById("field-step").textContent = payload.step === "token" ? "Token (Kushki.js)" : "Cargo (API)";
    document.getElementById("field-code").textContent = payload.code || "—";
    document.getElementById("field-ticket").textContent = payload.ticketNumber || "—";
    document.getElementById("field-reference").textContent = payload.transactionReference || "—";
    resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function fillCard(event) {
    const button = event.currentTarget;
    form.name.value = "Juan Perez";
    form.number.value = button.dataset.number;
    form.expiryMonth.value = "12";
    form.expiryYear.value = "29";
    form.cvc.value = "123";
  }

  document.querySelectorAll("[data-number]").forEach((button) => {
    button.addEventListener("click", fillCard);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "Tokenizando…";
    resultEl.hidden = true;

    const tokenRequest = {
      amount: String(checkout.totalAmount),
      currency: checkout.currency,
      name: form.name.value.trim(),
      number: form.number.value.replace(/\s+/g, ""),
      expiryMonth: form.expiryMonth.value.padStart(2, "0"),
      expiryYear: form.expiryYear.value.slice(-2),
      cvc: form.cvc.value,
    };

    kushki.requestToken(tokenRequest, async (response) => {
      if (response.code || !response.token) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Pagar";
        showResult({
          approved: false,
          status: "DECLINED",
          step: "token",
          ticketNumber: "",
          transactionReference: "",
          code: response.code || "017",
          message: response.message || "Transacción declinada en solicitud de token",
        });
        return;
      }

      submitBtn.textContent = "Cobrando…";
      try {
        const chargeResponse = await fetch("/api/charges", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            token: response.token,
            kushkiPaymentMethod: "card",
            cart_id: "demo-001",
            firstName: form.name.value.trim().split(" ")[0],
            lastName: form.name.value.trim().split(" ").slice(1).join(" "),
          }),
        });
        const payload = await chargeResponse.json();
        showResult(payload);
      } catch (error) {
        showResult({
          approved: false,
          status: "DECLINED",
          step: "charge",
          ticketNumber: "",
          transactionReference: "",
          code: "500",
          message: error.message || "No fue posible contactar el API de cargo",
        });
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Pagar";
      }
    });
  });
})();
