// /netlify/functions/wa-webhook.js
// CommonJS como el resto de las funciones: el package.json no declara
// "type": "module", así que la sintaxis ESM dependía de que el bundler la
// transpilara sola.

exports.handler = async (event) => {
  const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;
  const N8N_INCOMING_URL = process.env.N8N_WA_INCOMING_URL;

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
