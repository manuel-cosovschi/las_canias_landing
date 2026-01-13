// /netlify/functions/availability.js
const { json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  // público: solo lectura
  const method = event.httpMethod;

  if (method !== "GET" && method !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET; // <-- este es el largo
    const path = process.env.N8N_AVAILABILITY_PATH || "/webhook/762ab856-f304-447f-8267-aef78e72609f";

    if (!baseUrl || !secret) {
      return json(500, { message: "Faltan env vars: N8N_BASE_URL / N8N_SECRET" });
    }

    let house_code = "";

    if (method === "GET") {
      house_code = (event.queryStringParameters?.house_code || "").trim();
    } else {
      const body = JSON.parse(event.body || "{}");
      house_code = String(body.house_code || "").trim();
    }

    if (!house_code) return json(400, { message: "Falta house_code" });

    const out = await callN8n(path, {
      method: "POST",
      body: { house_code },
      baseUrl,
      secret,
    });

    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};