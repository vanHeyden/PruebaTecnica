const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const uatDefaults = {
  KUSHKI_API_BASE_URL: "https://api-uat.kushkipagos.com",
  KUSHKI_KFORM_ID: "NjdqaKBZC",
  KUSHKI_MERCHANT_ID: "20000000105136820000",
  KUSHKI_PUBLIC_KEY: "01325a24f50043189986834c6053c7a9",
  KUSHKI_PRIVATE_KEY: "1410ba3e03ce44a1852265f0334bded0",
};

function env(name) {
  const value = process.env[name];
  if (value !== undefined && value !== "") {
    return value;
  }
  return uatDefaults[name];
}

function required(name) {
  const value = env(name);
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
  host: process.env.HOST || "0.0.0.0",
  apiBaseUrl: required("KUSHKI_API_BASE_URL").replace(/\/$/, ""),
  kformId: required("KUSHKI_KFORM_ID"),
  merchantId: env("KUSHKI_MERCHANT_ID") || "",
  publicKey: required("KUSHKI_PUBLIC_KEY"),
  privateKey: required("KUSHKI_PRIVATE_KEY"),
  amount,
};

module.exports = { config };
