// /netlify/functions/availability.js
const { json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  // ✅ GET público
  if (event.httpMethod !== "GET") {
    return json(405, { message: "Method not allowed" });
  }

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    if (!baseUrl || !secret) {
      return json(500, { message: "Faltan env vars en Netlify" });
    }

    const house_code =
      event.queryStringParameters?.house_code ||
      event.queryStringParameters?.house ||
      "";

    if (!house_code) {
      return json(400, { message: "Falta house_code" });
    }

    // 👉 webhook PRODUCTIVO (no test)
    const out = await callN8n(
      "/webhook/762ab856-f304-447f-8267-aef78e72609f",
      {
        method: "POST",
        body: { house_code },
        baseUrl,
        secret,
      }
    );

    // Esperado:
    // { ok:true, house_code, blocked:[{start,end}] }
    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error availability" });
  }
};