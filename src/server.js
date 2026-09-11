const path = require("path");
const express = require("express");
const { config } = require("./config");
const { createCardCharge } = require("./kushki");

const app = express();
const publicDir = path.join(__dirname, "..", "public");

app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/assets", express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    environment: "uat",
    apiBaseUrl: config.apiBaseUrl,
  });
});

app.get("/config.js", (_req, res) => {
  res.type("application/javascript").send(`window.__KUSHKI_CHECKOUT__ = ${JSON.stringify({
    kformId: config.kformId,
    publicMerchantId: config.publicKey,
    merchantId: config.merchantId,
    inTestEnvironment: true,
    amount: {
      subtotalIva: config.amount.subtotalIva,
      iva: config.amount.iva,
      subtotalIva0: config.amount.subtotalIva0,
    },
    currency: config.amount.currency,
  })};`);
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.post("/checkout", async (req, res) => {
  try {
    const result = await createCardCharge(req.body);
    const approved = result.approved;
    const payload = {
      approved,
      httpStatus: result.httpStatus,
      ticketNumber: result.data.ticketNumber || "",
      transactionReference: result.data.transactionReference || "",
      details: result.data.details || result.data,
      code: result.data.code || result.data.processorError || "",
      message:
        result.data.message ||
        result.data.details?.responseText ||
        (approved ? "Transacción aprobada" : "Transacción declinada"),
    };

    const query = new URLSearchParams({
      status: approved ? "approved" : "declined",
      ticket: payload.ticketNumber,
      reference: payload.transactionReference,
      code: String(payload.code),
      message: payload.message,
    });

    return res.redirect(`/resultado?${query.toString()}`);
  } catch (error) {
    const query = new URLSearchParams({
      status: "declined",
      ticket: "",
      reference: "",
      code: String(error.status || 500),
      message: error.message || "No fue posible procesar el pago",
    });
    return res.redirect(`/resultado?${query.toString()}`);
  }
});

app.get("/resultado", (_req, res) => {
  res.sendFile(path.join(publicDir, "resultado.html"));
});

app.use((err, _req, res, _next) => {
  res.status(500).json({
    approved: false,
    message: "Error interno del comercio",
    detail: err.message,
  });
});

app.listen(config.port, () => {
  console.log(`Checkout Kajita UAT disponible en http://localhost:${config.port}`);
});
