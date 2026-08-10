// netlify/functions/availability.js
const { json, callN8n } = require("./_utils");

// end_inclusive viene como último día ocupado; lo pasamos a fin exclusivo (+1 día)
function inclusiveToExclusive(v) {
  const s = String(v).slice(0, 10);
  const ms = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + 86400000).toISOString().slice(0, 10);
}

function normalizeRanges(out) {
  // Esperamos algo tipo: { ok:true, blocked:[{start,end}...] }
  const blocked = Array.isArray(out?.blocked) ? out.blocked : [];
  const ranges = blocked
    .map((r) => ({
      from: r.from || r.start || r.check_in || r.begin,
      // sin este caso, los rangos con end_inclusive se descartaban silenciosamente
      to: r.end_inclusive
        ? inclusiveToExclusive(r.end_inclusive)
        : r.to || r.end || r.check_out || r.finish,
    }))
    .filter((r) => r.from && r.to);

  return {
    ok: true,
    house_code: out?.house_code,
    ranges,     // <- lo que usa flatpickr
    blocked,    // <- lo dejamos por si lo querés ver/debug
  };
}

exports.handler = async (event) => {
  // Público (solo lectura)
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    const path = process.env.N8N_AVAILABILITY_PATH;

    if (!baseUrl || !secret || !path) {
      return json(500, { message: "Faltan env vars: N8N_BASE_URL / N8N_SECRET / N8N_AVAILABILITY_PATH" });
    }

    let house_code = "";

    if (event.httpMethod === "GET") {
      house_code = event.queryStringParameters?.house_code || "";
    } else {
      const body = JSON.parse(event.body || "{}");
      house_code = body.house_code || "";
    }

    house_code = String(house_code).trim();
    if (!house_code) return json(400, { message: "Falta house_code" });

    const out = await callN8n(path, {
      method: "POST",
      body: { house_code },
      baseUrl,
      secret,
    });

    return json(200, normalizeRanges(out));
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};