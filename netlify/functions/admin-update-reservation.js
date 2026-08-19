// /netlify/functions/admin-update-reservation.js
const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  // Acción de dueño: se autentica con LC_OWNER_SECRET, igual que el resto del
  // admin. Antes comparaba contra N8N_SECRET, así que el panel (que manda la
  // clave que devuelve auth-login) recibía 401 si las dos claves diferían.
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.LC_OWNER_SECRET;
    const path = process.env.N8N_ADMIN_UPDATE_RESERVATION_PATH
      || "/webhook/admin-update-reservation";

    if (!baseUrl || !secret) {
      return json(500, { message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
    }

    const bodyIn = JSON.parse(event.body || "{}");
    const id = String(bodyIn.id || "").trim();
    const status = String(bodyIn.status || "").trim().toUpperCase();

    const allowed = ["CONFIRMED", "CANCELLED"];
    if (!id || !status) return json(400, { ok: false, message: "Faltan campos: id, status" });
    if (!allowed.includes(status)) {
      return json(400, { ok: false, message: `Status inválido. Usá: ${allowed.join(", ")}` });
    }

    const out = await callN8n(path, {
      method: "POST",
      body: { id, status },
      baseUrl,
      secret, // callN8n lo manda como x-lc-secret
    });

    return json(200, out);
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};