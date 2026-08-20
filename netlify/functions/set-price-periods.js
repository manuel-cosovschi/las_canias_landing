// /netlify/functions/set-price-periods.js
// Acción de dueño: reemplaza la lista de períodos de precio desde el panel.
// n8n vuelve a validar todo antes de escribir (fechas, precios, solapamientos);
// acá sólo cortamos lo que claramente no tiene sentido mandar.
const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  // Igual que en price-periods: el path va por defecto para no sumar env vars
  const path = process.env.N8N_SET_PRICE_PERIODS_PATH || "/webhook/set-price-periods";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const periods = body.periods;

    if (!Array.isArray(periods)) {
      return json(400, { ok: false, message: "Falta el campo periods (lista)" });
    }
    if (periods.length === 0) {
      return json(400, { ok: false, message: "Tiene que haber al menos un período" });
    }

    const out = await callN8n(path, { method: "POST", body: { periods }, baseUrl, secret });

    // n8n devuelve {ok:false,message} cuando la validación rechaza algo
    if (out && out.ok === false) {
      return json(400, out);
    }

    return json(200, out);
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
