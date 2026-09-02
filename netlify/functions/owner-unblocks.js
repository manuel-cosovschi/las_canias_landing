// netlify/functions/owner-unblocks.js
// Libera fechas bloqueadas: manda el rango a n8n, que pasa a CANCELLED los
// bloqueos de esa casa que lo pisan.
//
// Apunta a owner-unblock-v2 y no al owner-unblock original porque ese
// contestaba siempre {"ok":true,"deleted_count":"=1"} sin tocar la planilla
// —un valor fijo, con la expresión de n8n sin resolver—, así que el panel
// mostraba el tilde verde y la fecha seguía bloqueada.
//
// El path va por defecto, como en el resto de las funciones. Antes era una
// env var obligatoria y sin ella esto respondía 500.
const { assertAuth, json, callN8n } = require("./_utils");

function toYMD(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_OWNER_UNBLOCK_PATH || "/webhook/owner-unblock-v2";

  if (!baseUrl || !secret) {
    return json(500, { message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const payload = {
      house_code: String(body.house_code || "").trim(),
      checkin: toYMD(body.checkin),
      checkout: toYMD(body.checkout),
      note: body.note || "", // opcional (por si querés log)
    };

    if (!payload.house_code || !payload.checkin || !payload.checkout) {
      return json(400, { message: "house_code, checkin y checkout son obligatorios" });
    }

    if (payload.checkout <= payload.checkin) {
      return json(400, { message: "checkout debe ser posterior a checkin" });
    }

    const out = await callN8n(path, { method: "POST", body: payload, baseUrl, secret });
    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};