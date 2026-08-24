// netlify/functions/reservation-document.js
//
// Devuelve el documento de reserva confirmada ya armado y personalizado.
//
// Lo usan dos lados:
//  - el flujo de confirmación de n8n, que pide el HTML y lo manda por mail al
//    huésped apenas el dueño confirma la transferencia;
//  - el panel de admin, para verlo o imprimirlo desde una reserva confirmada.
//
// Recibe la fila de la reserva en el body (el panel y n8n ya la tienen, así se
// evita otra vuelta a la planilla) y busca las tarifas para calcular el total.

const { assertAuth, json, callN8n } = require("./_utils");
const { renderDocumento } = require("./_documento");

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

  return { from, to, prices };
}

// Si las tarifas no se pueden leer no cortamos: el documento sale igual, con
// los importes a coordinar. Vale más que salga sin precios a que el huésped no
// reciba nada al confirmar.
async function traerPeriodos() {
  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_GET_PRICE_PERIODS_PATH || "/webhook/get-price-periods";

  if (!baseUrl || !secret) return [];

  try {
    const out = await callN8n(path, { method: "GET", baseUrl, secret });
    const raw = Array.isArray(out?.periods) ? out.periods : [];
    return raw.map(normalizePeriod).filter(Boolean);
  } catch {
    return [];
  }
}

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    const reserva = body.reservation || body.row || body;

    if (!reserva || !reserva.house_code) {
      return json(400, { message: "Falta la reserva (house_code)" });
    }
    if (!reserva.check_in || !reserva.check_out) {
      return json(400, { message: "La reserva no tiene fechas" });
    }

    const periodos = await traerPeriodos();
    const html = renderDocumento(reserva, periodos);

    // format=html devuelve la página tal cual, para abrirla directo en el panel
    if ((event.queryStringParameters?.format || "") === "html") {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
        body: html,
      };
    }

    return json(200, { ok: true, html });
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};
