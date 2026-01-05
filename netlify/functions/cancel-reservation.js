const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event, context) => {
  if (!assertAuth(context)) return json(401, { message: "No autorizado" });

  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    if (!baseUrl || !secret) return json(500, { message: "Faltan env vars en Netlify" });

    const body = JSON.parse(event.body || "{}");
    if (!body.id) return json(400, { message: "Falta id" });

    const out = await callN8n("/webhook/cancel-reservation", {
      method: "POST",
      body: { id: body.id },
      baseUrl,
      secret,
    });

    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};