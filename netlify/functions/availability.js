const { json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  // Esta endpoint es PÚBLICA (para el calendario de disponibilidad)
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    if (!baseUrl || !secret) return json(500, { message: "Faltan env vars en Netlify" });

    const body = JSON.parse(event.body || "{}");
    if (!body.house_code) return json(400, { message: "Falta house_code" });

    // 👇 IMPORTANTE: acá NO va el UUID en el front, va acá adentro server-side
    const out = await callN8n("/webhook/762ab856-f304-447f-8267-aef78e72609f", {
      method: "POST",
      body: { house_code: body.house_code },
      baseUrl,
      secret,
    });

    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};