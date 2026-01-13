const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  // auth por header x-lc-secret contra LC_OWNER_SECRET
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_OWNER_BLOCK_PATH;

  if (!baseUrl || !secret || !path) {
    return json(500, { message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET / N8N_OWNER_BLOCK_PATH" });
  }

  try {
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

    const out = await callN8n(path, {
      method: "POST",
      body: payload,
      baseUrl,
      secret, // <-- Disney2026
    });

    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};