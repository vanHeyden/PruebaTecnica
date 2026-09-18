# AGENTS.md — Guía de trabajo

Convenciones para agentes (y para el equipo) al trabajar en este repositorio y en
desarrollos futuros con características similares. Nacen de lecciones aprendidas en este
proyecto; **aplícalas desde los pasos iniciales** para evitar retrabajo y gasto innecesario
de tokens.

## Proyecto (referencia rápida)

- **App:** checkout de pago único con tarjeta, Kushki México (ambiente UAT).
- **Stack:** Node.js ≥ 22 + Express. Frontend estático (HTML/CSS/JS servidos por Express, sin bundler).
- **Frontend:** Kushki.js v2 (**Hosted Fields**) — cada campo sensible se renderiza dentro de un iframe de Kushki. El navegador tokeniza contra `POST /card/v1/tokens` (llave pública); el PAN y el CVV nunca tocan el DOM ni el servidor.
- **Backend:** recibe el `kushkiToken` en `POST /checkout` y ejecuta `POST /card/v1/charges` (llave privada); redirige a `/` mostrando el estado de la transacción al pie del checkout (aprobada → ticket/referencia; declinada → motivo legible, sin datos sensibles).
- **Ejecutar:** `npm install` && `npm start` → http://localhost:3000 (modo dev: `npm run dev`). Salud: `/health`.
- **Datos de prueba (MX):** aprobada `5451951574925480`; declinada en token `4574441215190335`; declinada en cobro `4349003000047015`. CVV cualquiera; expiración futura.
- **Despliegue:** Railway (`Dockerfile` con `node:22-alpine`); `PORT` lo inyecta la plataforma; healthcheck en `/health`. Configuración por variables de entorno (ver `.env.example`); las credenciales privadas viven solo en el servidor.

## Convenciones de trabajo (aplicar desde el inicio)

1. **Últimas versiones/APIs por defecto.** Antes de codificar, revisar la documentación oficial y partir de las **últimas especificaciones/versiones estables**, priorizando las opciones de seguridad más recientes. (Lección: se arrancó con la API/SDK v1 y hubo que migrar a v2 / Hosted Fields, que es más segura.)
2. **Cuestionar y sugerir antes de arrancar.** Si en la revisión se determina que la forma correcta difiere de lo solicitado, plantear la sugerencia y **esperar aprobación** antes de desarrollar; no seguir un enfoque subóptimo. (Lección: se insistió en Kajita cuando lo correcto era un formulario propio basado en Kushki.js.)
3. **Seguridad y mejores prácticas primero.** Leer a fondo lineamientos y specs y aplicar la protección adecuada **desde el inicio**, no de forma incremental. (Lección del CVV: pasó de visible → `password` → Hosted Fields v2; debió nacer con Hosted Fields.) La llave privada nunca se expone en el cliente.
4. **Hosting desde el inicio.** Preguntar si el proyecto se **alojará en la web** (Railway u otro). Si es así, contemplar desde el arranque: variables de entorno, dependencias y **versiones estables/LTS soportadas** (no usar versiones sin soporte; p. ej., fijar una versión de Node LTS vigente). (Lección: hubo que migrar la versión de Node porque la usada ya no estaba soportada.)
5. **Responsividad y UX desde el diseño.** Diseñar responsivo desde el inicio (móvil, orientación vertical, vistas reducidas), buscando la mejor experiencia en distintos dispositivos.
6. **Eficiencia.** Arrancar con una **fase breve de descubrimiento** en un solo bloque de preguntas: objetivo y criterios de aceptación, hosting/despliegue, versiones y specs de APIs/SDKs, requisitos de seguridad, dispositivos objetivo y datos de prueba. Preferir cambios pequeños y verificables; no repetir pruebas costosas (p. ej. GUI) cuando el cambio es trivial (documentación, logging, texto).

## Pruebas y evidencia

- Probar el entorno y las funcionalidades y compartir **capturas de pantalla** como evidencia y apoyo al debugging.
- **Videos del roundtrip: NO grabarlos por defecto.** Avisar cuando la funcionalidad esté lista y **esperar la comprobación y autorización explícita del usuario** antes de grabarlos.

## Pendientes conocidos

- **Responsive (CVV):** en vista reducida / vertical (móvil), el campo CVV (iframe del Hosted Field) no se ajusta al ancho de la ventana y se desborda hacia la izquierda, perdiéndose su visualización. Hacer fluido el CSS de los Hosted Fields (`.hosted-field` y su `iframe`) y el layout de `.field-row`. Diferido por decisión del usuario.
