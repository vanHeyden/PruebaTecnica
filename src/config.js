const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

const amount = {
  subtotalIva: Number(process.env.AMOUNT_SUBTOTAL_IVA ?? 0),
  iva: Number(process.env.AMOUNT_IVA ?? 0),
  subtotalIva0: Number(process.env.AMOUNT_SUBTOTAL_IVA0 ?? 1000),
  ice: 0,
  currency: process.env.KUSHKI_CURRENCY || "MXN",
};

const config = {
  port: Number(process.env.PORT) || 3000,
  apiBaseUrl: (process.env.KUSHKI_API_BASE_URL || "https://api-uat.kushkipagos.com").replace(
    /\/$/,
    ""
  ),
  kformId: required("KUSHKI_KFORM_ID"),
  merchantId: process.env.KUSHKI_MERCHANT_ID || "",
  publicKey: required("KUSHKI_PUBLIC_KEY"),
  privateKey: required("KUSHKI_PRIVATE_KEY"),
  amount,
};

module.exports = { config };
