// /netlify/functions/set-calendar-config.js
// Acción de dueño: reemplaza las reglas del calendario desde el panel.
// n8n vuelve a validar todo antes de escribir (fechas, mínimos, solapamientos);
// acá sólo cortamos lo que claramente no tiene sentido mandar.
const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  // Igual que en calendar-config: el path va por defecto para no sumar env vars
  const path = process.env.N8N_SET_CALENDAR_CONFIG_PATH || "/webhook/set-calendar-config";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const config = body.config;

    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return json(400, { ok: false, message: "Falta el campo config" });
    }
    if (!config.last_date) {
      return json(400, { ok: false, message: "Falta la última fecha reservable" });
    }

    const out = await callN8n(path, { method: "POST", body: { config }, baseUrl, secret });

    // n8n devuelve {ok:false,message} cuando la validación rechaza algo
    if (out && out.ok === false) {
      return json(400, out);
    }

    return json(200, out);
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
