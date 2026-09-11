# Integración de pagos únicos con Kajita — Kushki México (UAT)

Aprenderás cómo este comercio recibe un pago único con tarjeta en el ambiente de pruebas de Kushki: el front-end obtiene el token con **Kushki.js**, el back-end confirma el cobro con **POST /card/v1/charges** y la misma pantalla muestra si la transacción fue **aprobada** o **declinada**.

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
| Producto de captura | Kushki.js (`kushki.min.js`) |
| ID de Kajita (referencia de consola) | `NjdqaKBZC` |
| ID de comercio | `20000000105136820000` |
| `publicMerchantId` | credencial pública (llave pública) |
| Endpoint de cobro | `POST /card/v1/charges` |
| Moneda | `MXN` |
| Monto de demostración | `subtotalIva: 0`, `iva: 0`, `subtotalIva0: 1000` |

##### Importante

El token generado por Kajita **no es una tokenización de suscripción**. Es un identificador de intención de pago de un solo uso. El `subscriptionId` aplica solo a cargos recurrentes. La llave privada (`Private-Merchant-Id`) vive exclusivamente en el servidor.

---

## 2. Arquitectura

```
Navegador                         Comercio                      Kushki UAT
─────────                         ────────                      ──────────
1. Completa el formulario
2. Kushki.js requestToken  ─────────────────────────────────►  Token
3. fetch POST /api/charges        Express
4.                                Private-Merchant-Id  ─────►  POST /card/v1/charges
5. Resultado en la misma pantalla ◄──────────────────────────  Aprobado o declinado
```

- **Front-end:** HTML + `https://cdn.kushkipagos.com/kushki.min.js`. El token se pide con `requestToken` y el estado se pinta al instante, sin recargar.
- **Back-end:** Node.js 22+ y Express. `POST /api/charges` cobra en UAT con `Private-Merchant-Id` y responde JSON.
- **Secretos:** en local se usa `.env` (ignorado por git). En Railway hay valores UAT por defecto; el navegador solo recibe la llave pública vía `/config.js`.

---

## 3. Proceso de pago (transacción aprobada)

El flujo que integrarás es el mismo que describe Kushki para pagos en un paso.

### 3.1 Configura el front-end

1. Carga `kushki.min.js` desde el CDN.
2. Inicializa Kushki.js en ambiente de pruebas con la credencial pública.
3. Al enviar el formulario, llama a `requestToken` y, si hay token, cobra con `POST /api/charges`.

```javascript
const kushki = new Kushki({
  merchantId: "{publicCredentialId}",
  inTestEnvironment: true,
});

kushki.requestToken({
  amount: "1000",
  currency: "MXN",
  name: "Juan Perez",
  number: "5451951574925480",
  expiryMonth: "12",
  expiryYear: "29",
  cvc: "123",
}, async (response) => {
  if (response.code) {
    // Declinada en token: se muestra en pantalla
    return;
  }
  await fetch("/api/charges", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token: response.token }),
  });
});
```

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

Kushki.js entrega el token al callback del front-end. El comercio lo envía al back-end:

```json
{
  "cart_id": "demo-001",
  "kushkiToken": "6ce49238fa81427e8b206c9c7aac09d3",
  "kushkiPaymentMethod": "card"
}
```

Si el cliente elige meses, también llegan `kushkiDeferred` y `kushkiDeferredType`. Esos valores se reenvían en el cargo.

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

Una autorización exitosa incluye `ticketNumber` y `transactionReference`. La aplicación pinta en la misma pantalla el estado `APPROVED` con ticket y referencia.

El comercio puede consultar la transacción también en la [consola UAT](https://uat-console.kushkipagos.com/auth).

---

## 4. Proceso de declinación

Una declinación puede ocurrir **antes** del cargo (al pedir el token) o **durante** el cargo (API `/charges`). En ambos casos el comercio no debe reintentar el mismo token: hay que capturar de nuevo los datos y generar uno nuevo (`K008`, `K048`, `K049`).

### 4.1 Declinada en solicitud de token (front-end)

Kushki.js valida la tarjeta contra Kushki y **no entrega** un token válido al comercio.

| Campo | Valor |
| --- | --- |
| Número de tarjeta | `4574441215190335` |
| Respuesta esperada | `(017) Tarjeta no válida` |

Qué ocurre en esta app: el callback de `requestToken` trae `code` y `message`. No se llama al cargo y el panel muestra `DECLINED` en el paso Token.

### 4.2 Declinada en solicitud de cobro (back-end)

El token se genera, pero `/card/v1/charges` rechaza la operación.

| Campo | Valor |
| --- | --- |
| Número de tarjeta | `4349003000047015` |
| Respuesta esperada | `(017) Tarjeta no válida` |

Qué ocurre en esta app: Express recibe el token, llama a UAT, interpreta `code` / `processorError` / `message` y el panel muestra `DECLINED` en el paso Cargo.

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

El panel de resultado en la misma vista muestra el código y el mensaje para trazabilidad, sin exponer la llave privada ni el PAN.

---

## 5. Seguridad y buenas prácticas aplicadas

- La llave privada nunca se renderiza en HTML ni en `/config.js`.
- `.env` está en `.gitignore`; el repositorio solo incluye `.env.example`.
- El script de Kushki.js se carga desde el CDN oficial.
- El monto del cargo replica el monto con el que se tokenizó (`subtotalIva0: 1000`) para evitar `K220`.
- Headers mínimos: `Private-Merchant-Id` y `Content-Type`.
- Ambiente fijo UAT (`api-uat.kushkipagos.com`). Producción usaría `api.kushkipagos.com`, credenciales productivas y Kajita publicada en modo producción.

---

## 6. Estructura del repositorio

```
PruebaTecnica/
├── public/            # Formulario Kushki.js, resultado en vivo y estilos
├── src/
│   ├── config.js      # Lectura de variables de entorno
│   ├── kushki.js      # Cliente HTTP del cargo UAT
│   └── server.js      # Express: /api/charges y resultado JSON
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

5. Completa el formulario (o usa las tarjetas de prueba) y pulsa **Pagar**. El estado aprobado o declinado aparece debajo del formulario.

Modo recarga automática durante desarrollo: `npm run dev`.

Verificación rápida del servicio: [http://localhost:3000/health](http://localhost:3000/health).

### Deploy en Railway

Railway no incluye el archivo `.env` del repositorio. Esta app usa valores UAT por defecto (comercio y credenciales de prueba) para que el servicio arranque en la web pública. `PORT` lo inyecta Railway y el proceso escucha en `0.0.0.0`. El build usa **Node 22** (`Dockerfile` con `node:22-alpine`).

Tras el deploy, abre la URL pública del servicio (por ejemplo `https://<proyecto>.up.railway.app`) y usa las tarjetas de prueba. El health check queda en `/health`.

Si quieres sobrescribir credenciales sin cambiar código, define las mismas variables de `.env.example` en **Variables** del servicio en Railway.

---

## 8. Paso a producción (fuera de alcance de esta prueba)

Según la [guía de paso a producción](https://docs.kushki.com/mx/getting-started/go-live):

1. Publicar la Kajita en modo producción desde la consola.
2. Sustituir llaves UAT por credenciales productivas.
3. Cambiar `inTestEnvironment` a `false`.
4. Apuntar el cobro a `https://api.kushkipagos.com/card/v1/charges`.
