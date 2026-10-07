const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_OWNER_CANCEL_PATH;

  if (!baseUrl || !secret || !path) {
    return json(500, { message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET / N8N_OWNER_CANCEL_PATH" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.id) return json(400, { message: "Falta id" });

    const out = await callN8n(path, {
      method: "POST",
      body: { id: body.id, reason: body.reason || "" },
      baseUrl,
      secret,
    });

    return json(200, out);
  } catch (e) {
    // n8n contesta 4xx cuando rechaza por validación ("se solapan los
    // períodos", "esa reserva ya está cancelada"). callN8n guarda ese código
    // en e.status justamente para esto: devolver 500 convierte un "escribiste
    // algo que no va" en un "se rompió el servidor".
    return json(e.status || 500, e.payload || { message: e.message || "Error" });
  }
};