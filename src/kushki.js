const { config } = require("./config");

function buildChargePayload(body) {
  const token = body.kushkiToken || body.token;
  if (!token) {
    const error = new Error("No se recibió kushkiToken desde Kajita");
    error.status = 400;
    throw error;
  }

  const payload = {
    token,
    amount: {
      subtotalIva: config.amount.subtotalIva,
      subtotalIva0: config.amount.subtotalIva0,
      ice: config.amount.ice,
      iva: config.amount.iva,
      currency: config.amount.currency,
    },
    metadata: {
      merchantId: config.merchantId,
      cartId: body.cart_id || "demo-001",
      paymentMethod: body.kushkiPaymentMethod || "card",
    },
    fullResponse: true,
  };

  const months = body.kushkiDeferred ? Number(body.kushkiDeferred) : null;
  if (months) {
    payload.months = months;
    payload.deferred = {
      months,
      creditType: body.kushkiDeferredType || "01",
      graceMonths: body.kushkiGraceMonths || "00",
    };
  }

  if (body.email || body.firstName || body.lastName) {
    payload.contactDetails = {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
    };
  }

  return payload;
}

function describeDeclineReason(data = {}) {
  const code = String(data.code || data.processorError || "").toUpperCase();
  const text = String(
    data.message || data.details?.responseText || data.details?.message || ""
  ).toLowerCase();
  const has = (...words) => words.some((word) => text.includes(word));

  if (has("token")) return "Declinado por token inválido o ya utilizado";
  if (code === "582" || has("cvv", "código de seguridad", "security code")) {
    return "Declinado por CVV incorrecto";
  }
  if (code === "551" || has("fondos", "insufficient")) {
    return "Declinado por fondos insuficientes";
  }
  if (has("bloque", "blocked", "restringid", "restricted")) {
    return "Declinado por tarjeta bloqueada";
  }
  if (has("no compatible", "not supported", "no soportad")) {
    return "Declinado por tarjeta no compatible";
  }
  if (has("expir", "vencid")) return "Declinado por tarjeta expirada";
  if (code === "K220" || has("monto")) {
    return "Declinado por monto que no coincide con el token";
  }
  if (code === "K004" || has("credencial", "credential")) {
    return "Declinado por credencial inválida";
  }
  if (has("no válida", "no valida", "invalid card", "inválida", "invalida")) {
    return "Declinado por tarjeta no válida";
  }
  return "Transacción declinada";
}

async function createCardCharge(formBody) {
  const payload = buildChargePayload(formBody);
  const response = await fetch(`${config.apiBaseUrl}/card/v1/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Private-Merchant-Id": config.privateKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return {
    httpStatus: response.status,
    approved: response.ok && !data.code && (data.ticketNumber || data.transactionReference),
    data,
  };
}

module.exports = { createCardCharge, buildChargePayload, describeDeclineReason };
