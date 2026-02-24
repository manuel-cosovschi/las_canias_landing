const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "GET") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const ownerSecret = process.env.LC_OWNER_SECRET;
    const path = process.env.N8N_OWNER_GET_PRICES_PATH;

    if (!baseUrl || !ownerSecret || !path) {
      return json(500, {
        message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET / N8N_OWNER_GET_PRICES_PATH",
      });
    }

    const out = await callN8n(path, {
      method: "GET",
      baseUrl,
      secret: ownerSecret,
    });

    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};