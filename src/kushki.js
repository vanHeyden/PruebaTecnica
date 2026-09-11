const { config } = require("./config");

function buildChargePayload(body) {
  const token = body.kushkiToken || body.token;
  if (!token) {
    const error = new Error("No se recibió token desde Kushki.js");
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
  const responseCode = data.details?.responseCode || data.responseCode;
  const approved =
    (response.ok || response.status === 201) &&
    !data.code &&
    Boolean(data.ticketNumber || data.transactionReference || responseCode === "000");

  return {
    httpStatus: response.status,
    approved,
    data,
  };
}

function toPublicResult(result, extras = {}) {
  const data = result.data || {};
  const approved = Boolean(result.approved);
  return {
    approved,
    status: approved ? "APPROVED" : "DECLINED",
    step: extras.step || "charge",
    httpStatus: result.httpStatus,
    ticketNumber: data.ticketNumber || "",
    transactionReference: data.transactionReference || "",
    code: String(data.code || data.processorError || data.details?.responseCode || (approved ? "000" : "")),
    message:
      data.message ||
      data.details?.responseText ||
      extras.message ||
      (approved ? "(000) Transacción aprobada" : "Transacción declinada"),
  };
}

module.exports = { createCardCharge, buildChargePayload, toPublicResult };
