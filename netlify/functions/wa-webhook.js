export async function handler(event) {
  const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;
  const N8N_INCOMING_URL = process.env.N8N_WA_INCOMING_URL;

  // 1) Verificación (GET)
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    const mode = q["hub.mode"];
    const token = q["hub.verify_token"];
    const challenge = q["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
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
      return { statusCode: 500, body: "Missing N8N_WA_INCOMING_URL" };
    }

    await fetch(N8N_INCOMING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: event.body || "{}",
    });

    // Responder rápido a Meta
    return { statusCode: 200, body: "OK" };
  }

  return { statusCode: 405, body: "Method Not Allowed" };
}