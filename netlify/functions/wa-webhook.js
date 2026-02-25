export async function handler(event) {
  // 1) Verificación (GET)
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    const mode = q["hub.mode"];
    const token = q["hub.verify_token"];
    const challenge = q["hub.challenge"];

    // Cambiá por tu verify token exacto (el mismo que pusiste en Meta)
    const VERIFY_TOKEN = "lascanias_verify_2026";

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
        body: challenge
      };
    }
    return { statusCode: 403, body: "Forbidden" };
  }

  // 2) Mensajes (POST) -> forward a n8n
  if (event.httpMethod === "POST") {
    const N8N_INCOMING_URL =
      "https://cosovschim.app.n8n.cloud/webhook/whatsapp-incoming";

    const resp = await fetch(N8N_INCOMING_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: event.body || "{}"
    });

    // Respondemos rápido a Meta
    return {
      statusCode: 200,
      body: "OK"
    };
  }

  return { statusCode: 405, body: "Method Not Allowed" };
}