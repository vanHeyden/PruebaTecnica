const path = require("path");
const express = require("express");
const { config } = require("./config");
const { createCardCharge, describeDeclineReason } = require("./kushki");

const app = express();
const publicDir = path.join(__dirname, "..", "public");

app.set("trust proxy", 1);
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
    const approved = Boolean(result.approved);
    const reason = approved
      ? "Transacción aprobada"
      : describeDeclineReason(result.data);

    const query = new URLSearchParams({
      status: approved ? "approved" : "declined",
      reason,
      code: String(result.data.code || result.data.processorError || ""),
      ticket: result.data.ticketNumber || "",
      reference: result.data.transactionReference || "",
    });

    return res.redirect(`/?${query.toString()}`);
  } catch (error) {
    const query = new URLSearchParams({
      status: "declined",
      reason:
        error.status === 400
          ? "No se recibió el token de Kushki"
          : "No fue posible procesar el pago",
      code: String(error.status || 500),
      ticket: "",
      reference: "",
    });
    return res.redirect(`/?${query.toString()}`);
  }
});

app.use((err, _req, res, _next) => {
  res.status(500).json({
    approved: false,
    message: "Error interno del comercio",
    detail: err.message,
  });
});

app.listen(config.port, config.host, () => {
  console.log(`Checkout Kajita UAT escuchando en http://${config.host}:${config.port}`);
});
