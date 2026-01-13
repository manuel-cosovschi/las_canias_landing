const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const n8nSecret = process.env.N8N_SECRET;
    const path = process.env.N8N_OWNER_BLOCK_PATH;

    if (!baseUrl || !n8nSecret || !path) {
      return json(500, { message: "Faltan env vars: N8N_BASE_URL / N8N_SECRET / N8N_OWNER_BLOCK_PATH" });
    }

    const body = JSON.parse(event.body || "{}");
    const payload = {
      house_code: body.house_code,
      checkin: body.checkin,
      checkout: body.checkout,
      note: body.note || "",
    };

    if (!payload.house_code || !payload.checkin || !payload.checkout) {
      return json(400, { message: "house_code, checkin y checkout son obligatorios" });
    }

    const out = await callN8n(path, { method: "POST", body: payload, baseUrl, secret: n8nSecret });
    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};