const { json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  // Endpoint PÚBLICO (lo llama reservar.html)
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    if (!baseUrl || !secret) return json(500, { message: "Faltan env vars en Netlify" });

    const body = JSON.parse(event.body || "{}");

    const required = ["house_code", "guests", "checkin", "checkout", "guest_name", "dni", "email", "phone", "payment_method"];
    const missing = required.filter((k) => !body[k]);
    if (missing.length) return json(400, { message: `Faltan campos: ${missing.join(", ")}` });

    // Llamamos al workflow de n8n (SIN exponer URL en el front)
    const out = await callN8n("/webhook/create-reservation", {
      method: "POST",
      body,
      baseUrl,
      secret,
    });

    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};