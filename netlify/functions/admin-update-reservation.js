// /netlify/functions/admin-update-reservation.js
const { json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    if (!baseUrl || !secret) return json(500, { message: "Faltan env vars en Netlify" });

    // ✅ proteger admin con x-lc-secret
    const ownerSecret = event.headers["x-lc-secret"] || event.headers["X-Lc-Secret"] || "";
    if (ownerSecret !== secret) {
      return json(401, { ok: false, message: "Unauthorized" });
    }

    const bodyIn = JSON.parse(event.body || "{}");
    const id = String(bodyIn.id || "").trim();
    const status = String(bodyIn.status || "").trim().toUpperCase();

    const allowed = ["CONFIRMED", "CANCELLED"];
    if (!id || !status) return json(400, { ok: false, message: "Faltan campos: id, status" });
    if (!allowed.includes(status)) {
      return json(400, { ok: false, message: `Status inválido. Usá: ${allowed.join(", ")}` });
    }

    // ⚠️ este path lo seteás al webhook nuevo
    const out = await callN8n("/webhook/admin-update-reservation", {
      method: "POST",
      body: { id, status },
      baseUrl,
      secret, // se manda como x-lc-secret en callN8n si lo tenés armado así
    });

    return json(200, out);
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};