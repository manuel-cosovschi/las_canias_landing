// /netlify/functions/wa-webhook.js
// CommonJS como el resto de las funciones: el package.json no declara
// "type": "module", así que la sintaxis ESM dependía de que el bundler la
// transpilara sola.
const crypto = require("crypto");

// Meta firma cada POST con el secreto de la app (X-Hub-Signature-256). Sin
// comprobarla, esta URL es pública y cualquiera puede inventar un mensaje:
// el bot lo contesta y además aparece como una conversación real en el CRM.
//
// Se activa sola apenas exista META_APP_SECRET en Netlify. Mientras no esté,
// sigue funcionando como hasta ahora y lo avisa por consola: encender esto a
// ciegas dejaría el bot mudo si el secreto estuviera mal cargado, que es peor
// que el problema que resuelve.
function firmaValida(event, secret) {
  const cabecera =
    event.headers["x-hub-signature-256"] ||
    event.headers["X-Hub-Signature-256"] ||
    "";
  if (!cabecera.startsWith("sha256=")) return false;

  const cuerpo = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64")
    : Buffer.from(event.body || "", "utf8");

  const esperada = "sha256=" + crypto.createHmac("sha256", secret).update(cuerpo).digest("hex");

  // timingSafeEqual exige los dos del mismo largo, y tira si no lo son.
  const a = Buffer.from(cabecera);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;
  const N8N_INCOMING_URL = process.env.N8N_WA_INCOMING_URL;
  const APP_SECRET = process.env.META_APP_SECRET;

  // 1) Verificación (GET)
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    const mode = q["hub.mode"];
    const token = q["hub.verify_token"];
    const challenge = q["hub.challenge"];

    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN && challenge) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
        body: challenge,
      };
    }

    return { statusCode: 403, body: "Forbidden" };
  }

  // 2) Mensajes (POST) -> forward a n8n
  if (event.httpMethod === "POST") {
    if (!N8N_INCOMING_URL) {
      console.error("wa-webhook: falta N8N_WA_INCOMING_URL");
      return { statusCode: 500, body: "Missing N8N_WA_INCOMING_URL" };
    }

    if (APP_SECRET) {
      if (!firmaValida(event, APP_SECRET)) {
        // 403 y no 502: a Meta no hay que pedirle que reintente algo que no
        // mandó Meta.
        console.error("wa-webhook: firma inválida, se descarta el mensaje");
        return { statusCode: 403, body: "Invalid signature" };
      }
    } else {
      console.warn(
        "wa-webhook: META_APP_SECRET no está configurado; se acepta el mensaje sin verificar la firma"
      );
    }

    try {
      const res = await fetch(N8N_INCOMING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: event.body || "{}",
      });

      // Si n8n rechaza el mensaje devolvemos error para que Meta reintente:
      // un 200 acá daría el mensaje por entregado y se perdería la consulta.
      if (!res.ok) {
        console.error(`wa-webhook: n8n respondió ${res.status}`);
        return { statusCode: 502, body: "Upstream error" };
      }
    } catch (e) {
      // Antes esta excepción se propagaba sin loguearse
      console.error("wa-webhook: no se pudo reenviar a n8n:", e.message);
      return { statusCode: 502, body: "Upstream unreachable" };
    }

    return { statusCode: 200, body: "OK" };
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};
