# Integración de pagos únicos con tarjeta — Kushki México (UAT)

Aprenderás cómo este comercio recibe un pago único con tarjeta en el ambiente de pruebas de Kushki: el front-end captura los datos con **Kushki.js v2 (Hosted Fields)** —cada campo sensible vive dentro de un iframe de Kushki—, la librería tokeniza contra Kushki (`/card/v1/tokens`, llave pública), devuelve un **token de intención de pago** y el back-end confirma el cobro contra la API UAT (`/card/v1/charges`, llave privada).

Documentación de producto: [docs.kushki.com/mx](https://docs.kushki.com/mx)  
Referencia de API México: [api-docs.kushkipagos.com/mexico/home](https://api-docs.kushkipagos.com/mexico/home)  
Kajita: [Crear un formulario de pagos](https://docs.kushki.com/mx/payment-forms-and-buttons/kajita/create-a-payment-form/)  
Cargo con tarjeta: [Acepta un pago con tarjeta](https://docs.kushki.com/mx/card-payments/one-step-payments/accept-a-payment/)  
Datos de prueba: [Testing your integration](https://docs.kushki.com/mx/getting-started/testing-your-integration/)  
Códigos de error: [Pagos únicos con tarjeta](https://docs.kushki.com/mx/card-payments/one-step-payments/error-codes)

---

## 1. Descripción general

Esta prueba técnica implementa un **pago único con tarjeta en un paso** (token + charge) para México.

| Concepto | Valor en esta integración |
| --- | --- |
| País | México |
| Ambiente | UAT / pruebas (`inTestEnvironment: true`) |
| Consola UAT | [uat-console.kushkipagos.com](https://uat-console.kushkipagos.com/auth) |
| Base URL API | `https://api-uat.kushkipagos.com` |
| Producto de captura | Kushki.js v2 (Hosted Fields, iframes de Kushki) |
| Endpoint de tokenización | `POST /card/v1/tokens` (lo hace Kushki.js con la llave pública) |
| ID de comercio | `20000000105136820000` |
| `publicMerchantId` | credencial pública (llave pública) |
| Endpoint de cobro | `POST /card/v1/charges` (llave privada, desde el servidor) |
| Moneda | `MXN` |
| Monto de demostración | `subtotalIva: 0`, `iva: 0`, `subtotalIva0: 1000` |

##### Importante

El token generado en `/card/v1/tokens` **no es una tokenización de suscripción**. Es un identificador de intención de pago de un solo uso. El `subscriptionId` aplica solo a cargos recurrentes. La llave privada (`Private-Merchant-Id`) vive exclusivamente en el servidor.

---

## 2. Arquitectura

```
Navegador                         Comercio                    Kushki UAT
─────────                         ────────                    ──────────
1. Abre /                         Express sirve el checkout
2. Llena tarjeta y paga  ──────────────────────────────────► POST /card/v1/tokens (llave pública)
3. Recibe kushkiToken    ◄──────────────────────────────────  token
4. POST /checkout        ──────►  Back-end
5. Back-end              ──────────────────────────────────► POST /card/v1/charges (llave privada)
6. Estado en /           ◄──────  Aprobado o declinado ◄─────  ticket / referencia o motivo
```

- **Front-end:** HTML estático con **Kushki.js v2 (Hosted Fields)**. Cada campo (nombre, número, expiración y CVV) se renderiza dentro de un iframe de Kushki, por lo que el PAN y el CVV **nunca tocan el DOM ni el JavaScript** del comercio (se reduce el alcance PCI). La librería llama internamente a `POST /card/v1/tokens` con la llave pública y ejecuta 3DS/OTP/Sift; solo el `kushkiToken` se envía a `/checkout`.
- **Back-end:** Node.js 22+ y Express. Recibe el `kushkiToken`, arma el cuerpo del cargo y llama a `POST /card/v1/charges` de la API UAT con `Private-Merchant-Id`.
- **Secretos:** en local se usa `.env` (ignorado por git). En Railway hay valores UAT por defecto para que el proceso arranque sin Variables; el navegador solo recibe la llave pública vía `/config.js`.

---

## 3. Proceso de pago (transacción aprobada)

El flujo que integrarás es el mismo que describe Kushki para pagos en un paso.

### 3.1 Configura el front-end (Kushki.js v2 · Hosted Fields)

1. Se cargan las librerías de Kushki.js v2 desde el CDN:

```html
<script src="https://cdn.kushkipagos.com/js/latest/kushki.min.js"></script>
<script src="https://cdn.kushkipagos.com/js/latest/card.min.js"></script>
```

2. El formulario define un contenedor `<div>` por campo; Kushki inyecta un iframe seguro en cada uno:

```html
<form id="pay-form">
  <div id="id_cardholderName"></div>
  <div id="id_cardNumber"></div>
  <div id="id_expirationDate"></div>
  <div id="id_cvv"></div>
</form>
```

3. Se inicializa la instancia y los Hosted Fields con el monto, la moneda y los selectores:

```javascript
const kushkiInstance = await init({
  publicCredentialId: "{publicCredentialId}", // llave pública
  inTest: true,
});

const cardInstance = await initCardToken(kushkiInstance, {
  amount: { iva: 0, subtotalIva: 0, subtotalIva0: 1000 },
  currency: "MXN",
  fields: {
    cardholderName: { selector: "id_cardholderName" },
    cardNumber: { selector: "id_cardNumber" },
    cvv: { selector: "id_cvv", inputType: "password" },
    expirationDate: { selector: "id_expirationDate" },
  },
});

// Habilita el botón de pago solo cuando el formulario es válido.
cardInstance.onFieldValidity((event) => {
  payBtn.disabled = !event.isFormValid;
});
```

4. Al enviar, se llama a `requestToken()` sobre la instancia de tarjeta. Kushki.js valida los campos y ejecuta 3DS/OTP/Sift internamente; el PAN y el CVV nunca salen de los iframes de Kushki:

```javascript
try {
  const { token } = await cardInstance.requestToken();
  // token -> se envía a /checkout
} catch (error) {
  // error.code / error.message -> motivo declinado o validación
}
```

5. Con el `token` recibido, el navegador hace `POST /checkout` (solo el token, no los datos de tarjeta) para que el back-end ejecute el cargo.

### 3.2 El cliente paga con una tarjeta de aprobación

Usa los [datos de prueba de México](https://docs.kushki.com/mx/getting-started/testing-your-integration/):

| Campo | Valor |
| --- | --- |
| Número de tarjeta | `5451951574925480` |
| CVV | cualquiera |
| Código postal | cualquiera |
| Fecha de expiración | cualquier fecha futura |
| Respuesta esperada | `(000) Transacción aprobada` |

### 3.3 Recepción del token

El navegador hace `POST` a `/checkout` con un cuerpo similar a:

```json
{
  "cart_id": "demo-001",
  "kushkiToken": "6ce49238fa81427e8b206c9c7aac09d3",
  "kushkiPaymentMethod": "card"
}
```

Si la tokenización se declina (por ejemplo, tarjeta no válida), el navegador reenvía el código/motivo del error a `/checkout` para mostrar la declinación con un motivo legible.

### 3.4 Creación del cargo

El servidor llama al ambiente UAT:

```http
POST https://api-uat.kushkipagos.com/card/v1/charges
Private-Merchant-Id: {llave privada}
Content-Type: application/json
```

```json
{
  "token": "6ce49238fa81427e8b206c9c7aac09d3",
  "amount": {
    "subtotalIva": 0,
    "subtotalIva0": 1000,
    "ice": 0,
    "iva": 0,
    "currency": "MXN"
  },
  "fullResponse": true
}
```

### 3.5 Respuesta aprobada

Una autorización exitosa incluye `ticketNumber` y `transactionReference`. La aplicación redirige de vuelta a `/` con estado `approved` y muestra **Transacción aprobada** con ticket y referencia en la parte inferior del checkout.

El comercio puede consultar la transacción también en la [consola UAT](https://uat-console.kushkipagos.com/auth).

---

## 4. Proceso de declinación

Una declinación puede ocurrir **antes** del cargo (al pedir el token) o **durante** el cargo (API `/charges`). En ambos casos el comercio no debe reintentar el mismo token: hay que capturar de nuevo los datos y generar uno nuevo (`K008`, `K048`, `K049`).

### 4.1 Declinada en solicitud de token (front-end)

`POST /card/v1/tokens` valida la tarjeta contra Kushki y **no devuelve** un token válido (responde con `code`/`processorError`).

| Campo | Valor |
| --- | --- |
| Número de tarjeta | `4574441215190335` |
| Respuesta esperada | `(017) Tarjeta no válida` |

Qué ocurre en esta app: la tokenización en el navegador falla, así que se reenvía el código/mensaje del error a `/checkout` y este redirige a `/` mostrando el motivo declinado (por ejemplo, «Declinado por tarjeta no válida») al pie del checkout.

### 4.2 Declinada en solicitud de cobro (back-end)

El token se genera, pero `/card/v1/charges` rechaza la operación.

| Campo | Valor |
| --- | --- |
| Número de tarjeta | `4349003000047015` |
| Respuesta esperada | `(017) Tarjeta no válida` |

Qué ocurre en esta app: Express recibe el token, llama a UAT, interpreta `code` / `processorError` / `message`, deriva un motivo legible (por token, por CVV, por fondos, etc.) y lo muestra con estado `DECLINED` al pie del checkout, sin exponer datos sensibles.

### 4.3 Otros escenarios de prueba (México)

| Escenario | Tarjeta | Código típico |
| --- | --- | --- |
| Tarjeta no compatible | `4349008516656431` | `(019)` |
| Sin fondos | `4349001210846432` | `(021)` |
| CVV inválido | `4349003243371321` | `(022)` |
| Tarjeta bloqueada | `4349001386781322` | `(023)` |

Kushki distingue:

- `code`: validación propia de Kushki (ejemplo `K004` credencial inválida, `K220` monto distinto al del token).
- `processorError`: la transacción llegó al procesador/emisor (ejemplo `551` fondos insuficientes, `582` CVV incorrecto).

El checkout muestra el motivo y el código para trazabilidad, sin exponer la llave privada ni el PAN.

---

## 5. Seguridad y buenas prácticas aplicadas

- La llave privada nunca se renderiza en HTML ni en `/config.js`; solo se usa en el servidor para el cargo.
- El PAN, CVV y expiración se capturan en **Hosted Fields (iframes de Kushki)** y se tokenizan con Kushki.js v2; **no tocan el DOM ni el JavaScript** de este comercio ni llegan a este servidor (reduce el alcance PCI). El servidor solo maneja el `kushkiToken`.
- El campo CVV se renderiza como `inputType: "password"` dentro de su iframe (enmascarado), conforme a los requisitos de certificación de Kushki.
- `.env` está en `.gitignore`; el repositorio solo incluye `.env.example`.
- El monto del cargo replica el monto con el que se tokenizó (`subtotalIva0: 1000`) para evitar `K220`.
- Headers mínimos: `Public-Merchant-Id` para tokenizar y `Private-Merchant-Id` para el cargo.
- El estado se muestra sin exponer datos sensibles (ni PAN, ni CVV, ni token, ni llave privada).
- Ambiente fijo UAT (`api-uat.kushkipagos.com`). Producción usaría `api.kushkipagos.com` y credenciales productivas.

---

## 6. Estructura del repositorio

```
PruebaTecnica/
├── public/            # Checkout con estado de la transacción y estilos
├── src/
│   ├── config.js      # Lectura de variables de entorno
│   ├── kushki.js      # Cliente HTTP del cargo UAT + motivo de declinación
│   └── server.js      # Express: config, cargo y estado en /
├── .env.example
├── package.json
└── README.md
```

---

## 7. Cómo ejecutar el formulario en el navegador

Requisitos: [Node.js 22 o superior](https://nodejs.org/).

1. Clona el repositorio y entra a la carpeta:

   ```bash
   git clone https://github.com/vanHeyden/PruebaTecnica.git
   cd PruebaTecnica
   ```

2. Crea tu archivo de entorno a partir del ejemplo:

   ```bash
   copy .env.example .env
   ```

   En `.env` define `KUSHKI_PUBLIC_KEY` y `KUSHKI_PRIVATE_KEY`. No subas `.env` a git.

3. Instala dependencias y arranca el servidor:

   ```bash
   npm install
   npm start
   ```

4. Abre el navegador en [http://localhost:3000](http://localhost:3000).

5. Completa el formulario con una tarjeta de la tabla de datos de prueba y envía el pago. El estado de la transacción se muestra al pie del checkout.

Modo recarga automática durante desarrollo: `npm run dev`.

Verificación rápida del servicio: [http://localhost:3000/health](http://localhost:3000/health).

### Deploy en Railway

Railway no incluye el archivo `.env` del repositorio. Esta app usa valores UAT por defecto (comercio y credenciales de prueba) para que el servicio arranque en la web pública. `PORT` lo inyecta Railway y el proceso escucha en `0.0.0.0`. El build usa **Node 22** (`Dockerfile` con `node:22-alpine`) porque Node 18 ya no está disponible en Nixpacks.

Tras el deploy, abre la URL pública del servicio (por ejemplo `https://<proyecto>.up.railway.app`) y usa las tarjetas de prueba. El health check queda en `/health`.

Si quieres sobrescribir credenciales sin cambiar código, define las mismas variables de `.env.example` en **Variables** del servicio en Railway.

---

## 8. Paso a producción (fuera de alcance de esta prueba)

Según la [guía de paso a producción](https://docs.kushki.com/mx/getting-started/go-live):

1. Sustituir llaves UAT por credenciales productivas (pública y privada).
2. Apuntar la tokenización a `https://api.kushkipagos.com/card/v1/tokens`.
3. Apuntar el cobro a `https://api.kushkipagos.com/card/v1/charges`.
