// netlify/functions/owner-unblocks.js
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
  const path = process.env.N8N_OWNER_UNBLOCK_PATH; // 👈 nueva env var

  if (!baseUrl || !secret || !path) {
    return json(500, { message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET / N8N_OWNER_UNBLOCK_PATH" });
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