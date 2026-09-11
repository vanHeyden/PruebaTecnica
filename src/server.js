const path = require("path");
const express = require("express");
const { config } = require("./config");
const { createCardCharge, toPublicResult } = require("./kushki");

const app = express();
const publicDir = path.join(__dirname, "..", "public");

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/assets", express.static(publicDir));

function wantsJson(req) {
  const accept = String(req.get("accept") || "");
  return req.xhr || accept.includes("application/json") || req.path.startsWith("/api/");
}

async function handleCharge(req, res) {
  try {
    const result = await createCardCharge(req.body);
    const payload = toPublicResult(result, { step: "charge" });
    if (wantsJson(req)) {
      return res.status(result.approved ? 200 : result.httpStatus || 402).json(payload);
    }

    const query = new URLSearchParams({
      status: payload.approved ? "approved" : "declined",
      ticket: payload.ticketNumber,
      reference: payload.transactionReference,
      code: payload.code,
      message: payload.message,
    });
    return res.redirect(`/resultado?${query.toString()}`);
  } catch (error) {
    const payload = {
      approved: false,
      status: "DECLINED",
      step: "charge",
      httpStatus: error.status || 500,
      ticketNumber: "",
      transactionReference: "",
      code: String(error.status || 500),
      message: error.message || "No fue posible procesar el pago",
    };
    if (wantsJson(req)) {
      return res.status(payload.httpStatus).json(payload);
    }
    const query = new URLSearchParams({
      status: "declined",
      ticket: "",
      reference: "",
      code: payload.code,
      message: payload.message,
    });
    return res.redirect(`/resultado?${query.toString()}`);
  }
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    environment: "uat",
    apiBaseUrl: config.apiBaseUrl,
  });
});

app.get("/config.js", (_req, res) => {
  const totalAmount = config.amount.subtotalIva + config.amount.iva + config.amount.subtotalIva0;
  res.type("application/javascript").send(`window.__KUSHKI_CHECKOUT__ = ${JSON.stringify({
    publicMerchantId: config.publicKey,
    merchantId: config.merchantId,
    inTestEnvironment: true,
    amount: {
      subtotalIva: config.amount.subtotalIva,
      iva: config.amount.iva,
      subtotalIva0: config.amount.subtotalIva0,
    },
    currency: config.amount.currency,
    totalAmount,
  })};`);
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.post("/api/charges", handleCharge);
app.post("/checkout", handleCharge);

app.get("/resultado", (_req, res) => {
  res.sendFile(path.join(publicDir, "resultado.html"));
});

app.use((err, _req, res, _next) => {
  res.status(500).json({
    approved: false,
    status: "DECLINED",
    message: "Error interno del comercio",
    detail: err.message,
  });
});

app.listen(config.port, config.host, () => {
  console.log(`Checkout Kushki UAT escuchando en http://${config.host}:${config.port}`);
});
