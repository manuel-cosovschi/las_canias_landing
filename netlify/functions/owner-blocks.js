// netlify/functions/owner-blocks.js
const { assertAuth, json, callN8n } = require("./_utils");

function toYMD(v) {
  if (!v) return null;
  const s = String(v).trim();
  // ya viene YYYY-MM-DD desde tu UI
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // fallback: intentar parse
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

// rangos [start, end) => overlap si start < bEnd && end > bStart
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function getSiteBaseUrl() {
  // Netlify suele exponer URL / DEPLOY_PRIME_URL
  return (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.SITE_URL ||
    ""
  ).replace(/\/$/, "");
}

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_OWNER_BLOCK_PATH;

  if (!baseUrl || !secret || !path) {
    return json(500, { message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET / N8N_OWNER_BLOCK_PATH" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const payload = {
      house_code: String(body.house_code || "").trim(),
      checkin: toYMD(body.checkin),
      checkout: toYMD(body.checkout),
      note: body.note || "",
    };

    if (!payload.house_code || !payload.checkin || !payload.checkout) {
      return json(400, { message: "house_code, checkin y checkout son obligatorios" });
    }

    if (payload.checkout <= payload.checkin) {
      return json(400, { message: "checkout debe ser posterior a checkin" });
    }

    // ✅ 1) PRE-CHECK: no permitir solapar con bloqueos/ocupaciones existentes
    // Usamos tu function availability (pública desde tu admin.html)
    const site = getSiteBaseUrl();
    if (site) {
      const url = `${site}/.netlify/functions/availability?house_code=${encodeURIComponent(payload.house_code)}`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json().catch(() => ({}));

      const blockedRanges = []
        .concat(data.blocked || [])
        .concat(data.ranges || [])
        .map(r => ({
          start: toYMD(r.start || r.from || r.check_in),
          end: toYMD(r.end || r.to || r.check_out),
        }))
        .filter(r => r.start && r.end);

      const hasOverlap = blockedRanges.some(r =>
        rangesOverlap(payload.checkin, payload.checkout, r.start, r.end)
      );

      if (hasOverlap) {
        return json(409, {
          message: "Ese rango ya está ocupado/bloqueado para esa casa. No se puede volver a bloquear.",
          code: "OVERLAP",
        });
      }
    }

    // ✅ 2) Si está libre, recién ahí llamamos n8n para append BLOCKED
    const out = await callN8n(path, { method: "POST", body: payload, baseUrl, secret });
    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};