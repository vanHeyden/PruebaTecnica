# Integración de pagos únicos con Kajita — Kushki México (UAT)

Aprenderás cómo este comercio recibe un pago único con tarjeta en el ambiente de pruebas de Kushki: el front-end captura los datos con **Kajita**, Kushki devuelve un **token de intención de pago** y el back-end confirma el cobro contra la API UAT.

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
| Producto de captura | Kajita v2 (`kushki-checkout.js`) |
| ID de Kajita (`kformId`) | `NjdqaKBZC` |
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
Navegador                    Comercio                         Kushki UAT
─────────                    ────────                         ──────────
1. Abre /                    Express sirve Kajita
2. Completa Kajita  ──────►  CDN kushki-checkout.js  ──────►  Tokeniza PCI
3. POST /checkout   ◄──────  kushkiToken + método
4. Back-end         ──────────────────────────────────────►  POST /card/v1/charges
5. /resultado       ◄──────────────────────────────────────  Aprobado o declinado
```

- **Front-end:** HTML estático + script oficial desde `https://cdn.kushkipagos.com/kushki-checkout.js`. No se empaqueta ni se hostea una copia, para cumplir PCI.
- **Back-end:** Node.js 22+ y Express. Recibe el POST de Kajita, arma el cuerpo del cargo y llama a la API UAT con `Private-Merchant-Id`.
- **Secretos:** en local se usa `.env` (ignorado por git). En Railway hay valores UAT por defecto para que el proceso arranque sin Variables; el navegador solo recibe la llave pública vía `/config.js`.

---

## 3. Proceso de pago (transacción aprobada)

El flujo que integrarás es el mismo que describe Kushki para pagos en un paso.

### 3.1 Configura el front-end

1. Carga `kushki-checkout.js` desde el CDN.
2. Reserva un `<form id="my-form" action="/checkout" method="post">`. El `action` es la URL a la que Kajita envía el token.
3. Inicializa Kajita con el script de consola, en ambiente de pruebas:

```javascript
var kushki = new KushkiCheckout({
  kformId: "NjdqaKBZC",
  form: "my-form",
  publicMerchantId: "{publicCredentialId}", // llave pública
  inTestEnvironment: true,
  amount: {
    subtotalIva: 0,
    iva: 0,
    subtotalIva0: 1000,
  },
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

Kajita hace `POST` a `/checkout` con un cuerpo similar a:

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

Una autorización exitosa incluye `ticketNumber` y `transactionReference`. La aplicación redirige a `/resultado` con estado `approved` y muestra ticket y referencia.

El comercio puede consultar la transacción también en la [consola UAT](https://uat-console.kushkipagos.com/auth).

---

## 4. Proceso de declinación

Una declinación puede ocurrir **antes** del cargo (al pedir el token) o **durante** el cargo (API `/charges`). En ambos casos el comercio no debe reintentar el mismo token: hay que capturar de nuevo los datos y generar uno nuevo (`K008`, `K048`, `K049`).

### 4.1 Declinada en solicitud de token (front-end)

Kajita valida la tarjeta contra Kushki y **no envía** un token válido al comercio.

| Campo | Valor |
| --- | --- |
| Número de tarjeta | `4574441215190335` |
| Respuesta esperada | `(017) Tarjeta no válida` |

Qué ocurre en esta app: el usuario permanece en Kajita o no llega un `kushkiToken` usable. Si el POST llega vacío, `/checkout` redirige a resultado declinado.

### 4.2 Declinada en solicitud de cobro (back-end)

El token se genera, pero `/card/v1/charges` rechaza la operación.

| Campo | Valor |
| --- | --- |
| Número de tarjeta | `4349003000047015` |
| Respuesta esperada | `(017) Tarjeta no válida` |

Qué ocurre en esta app: Express recibe el token, llama a UAT, interpreta `code` / `processorError` / `message` y muestra `/resultado` con estado `DECLINED`.

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

La pantalla de resultado muestra el código y el mensaje para trazabilidad, sin exponer la llave privada ni el PAN.

---

## 5. Seguridad y buenas prácticas aplicadas

- La llave privada nunca se renderiza en HTML ni en `/config.js`.
- `.env` está en `.gitignore`; el repositorio solo incluye `.env.example`.
- El script de Kajita se carga desde el CDN oficial.
- El monto del cargo replica el monto con el que se tokenizó (`subtotalIva0: 1000`) para evitar `K220`.
- Headers mínimos: `Private-Merchant-Id` y `Content-Type`.
- Ambiente fijo UAT (`api-uat.kushkipagos.com`). Producción usaría `api.kushkipagos.com`, credenciales productivas y Kajita publicada en modo producción.

---

## 6. Estructura del repositorio

```
PruebaTecnica/
├── public/            # Página de checkout, resultado y estilos
├── src/
│   ├── config.js      # Lectura de variables de entorno
│   ├── kushki.js      # Cliente HTTP del cargo UAT
│   └── server.js      # Express: Kajita, cobro y resultado
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

5. Completa Kajita con una tarjeta de la tabla de datos de prueba y envía el pago. Serás redirigido a `/resultado`.

Modo recarga automática durante desarrollo: `npm run dev`.

Verificación rápida del servicio: [http://localhost:3000/health](http://localhost:3000/health).

### Deploy en Railway

Railway no incluye el archivo `.env` del repositorio. Esta app usa valores UAT por defecto (Kajita, comercio y credenciales de prueba) para que el servicio arranque en la web pública. `PORT` lo inyecta Railway y el proceso escucha en `0.0.0.0`. El build usa **Node 22** (`Dockerfile` con `node:22-alpine`) porque Node 18 ya no está disponible en Nixpacks.

Tras el deploy, abre la URL pública del servicio (por ejemplo `https://<proyecto>.up.railway.app`) y usa las tarjetas de prueba. El health check queda en `/health`.

Si quieres sobrescribir credenciales sin cambiar código, define las mismas variables de `.env.example` en **Variables** del servicio en Railway.

---

## 8. Paso a producción (fuera de alcance de esta prueba)

Según la [guía de paso a producción](https://docs.kushki.com/mx/getting-started/go-live):

1. Publicar la Kajita en modo producción desde la consola.
2. Sustituir llaves UAT por credenciales productivas.
3. Cambiar `inTestEnvironment` a `false`.
4. Apuntar el cobro a `https://api.kushkipagos.com/card/v1/charges`.
