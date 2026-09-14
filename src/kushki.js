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

const CARD_RESPONSE_CODES = {
  "017": "Declinado por tarjeta no válida",
  "019": "Declinado por tarjeta no compatible",
  "021": "Declinado por fondos insuficientes",
  "022": "Declinado por CVV incorrecto",
  "023": "Declinado por tarjeta bloqueada",
  "577": "Declinado por token inválido o ya utilizado",
};

function describeDeclineReason(data = {}) {
  const codes = [data.code, data.processorError, data.details?.responseCode]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const upperCodes = codes.map((value) => value.toUpperCase());
  const text = String(
    data.message ||
      data.details?.responseText ||
      data.details?.processorMessage ||
      ""
  ).toLowerCase();
  const has = (...words) => words.some((word) => text.includes(word));
  const hasCode = (...values) => values.some((value) => upperCodes.includes(value));

  if (has("token")) return "Declinado por token inválido o ya utilizado";
  if (hasCode("582", "022") || has("cvv", "código de seguridad", "security code")) {
    return "Declinado por CVV incorrecto";
  }
  if (hasCode("551", "021") || has("fondos", "insufficient")) {
    return "Declinado por fondos insuficientes";
  }
  if (hasCode("023") || has("bloque", "blocked", "restringid", "restricted")) {
    return "Declinado por tarjeta bloqueada";
  }
  if (hasCode("019") || has("no compatible", "not supported", "no soportad")) {
    return "Declinado por tarjeta no compatible";
  }
  if (has("expir", "vencid")) return "Declinado por tarjeta expirada";
  if (hasCode("K220") || has("monto")) {
    return "Declinado por monto que no coincide con el token";
  }
  if (hasCode("K004") || has("credencial", "credential")) {
    return "Declinado por credencial inválida";
  }
  if (hasCode("017") || has("no válida", "no valida", "invalid card", "inválida", "invalida")) {
    return "Declinado por tarjeta no válida";
  }

  for (const code of upperCodes) {
    if (CARD_RESPONSE_CODES[code]) return CARD_RESPONSE_CODES[code];
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
