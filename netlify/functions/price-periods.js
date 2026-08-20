// /netlify/functions/price-periods.js
// Público (solo lectura): reservar.html lo consulta para saber cuánto vale
// cada noche. También lo usa el panel de admin para poblar el formulario.
//
// Los períodos viven en la data table precios_periodos de n8n; el secret se
// usa sólo de Netlify a n8n y nunca llega al navegador.
const { json, callN8n } = require("./_utils");

const CASAS = ["LC1", "LC2", "LC3", "LC4", "LC5"];

function normalizePeriod(p) {
  if (!p || typeof p !== "object") return null;

  const from = String(p.from || "").slice(0, 10);
  const to = String(p.to || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  if (from > to) return null;

  const prices = {};
  for (const c of CASAS) {
    const n = Number((p.prices || {})[c]);
    if (!Number.isFinite(n) || n <= 0) return null;
    prices[c] = n;
  }

  return { from, to, label: String(p.label || ""), prices };
}

exports.handler = async () => {
  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  // El path del webhook no es secreto y va por defecto: las env vars de este
  // sitio ya rozan el límite de 4KB que AWS Lambda impone por función.
  const path = process.env.N8N_GET_PRICE_PERIODS_PATH || "/webhook/get-price-periods";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const out = await callN8n(path, { method: "GET", baseUrl, secret });

    const raw = Array.isArray(out?.periods) ? out.periods : null;
    if (!raw) {
      return json(502, { ok: false, message: "Respuesta de tarifas sin períodos" });
    }

    const periods = raw.map(normalizePeriod);

    // Un período ilegible no se descarta en silencio: si lo hiciéramos, esas
    // fechas quedarían sin precio y se cobrarían mal.
    const bad = periods.findIndex((p) => p === null);
    if (bad !== -1) {
      return json(502, { ok: false, message: "Período de precios ilegible", index: bad });
    }

    periods.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({ ok: true, periods }),
    };
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
