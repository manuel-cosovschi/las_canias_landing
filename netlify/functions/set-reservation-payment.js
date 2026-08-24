// netlify/functions/set-reservation-payment.js
//
// Guarda la parte de plata de una reserva: importe total, anticipo cobrado, si
// está facturada y a qué cotización del dólar se cerró.
//
// Es lo que los dueños llevaban en el Excel y la web no guardaba en ningún
// lado. El saldo no se guarda: sale de importe - anticipo, así no hay dos
// números que puedan quedar en desacuerdo.

const { assertAuth, json, callN8n } = require("./_utils");

// Un campo ausente no se toca; uno en "" se borra. Así el panel puede guardar
// sólo lo que el dueño editó sin pisar el resto.
function monto(v) {
  if (v === undefined) return undefined;
  if (v === null || String(v).trim() === "") return "";

  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_SET_PAYMENT_PATH || "/webhook/set-reservation-payment";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const id = String(body.id || "").trim();
    if (!id) return json(400, { ok: false, message: "Falta id" });

    const importe = monto(body.importe);
    const anticipo = monto(body.anticipo);
    const cotizacion = monto(body.cotizacion_usd);

    for (const [campo, valor] of [["importe", importe], ["anticipo", anticipo], ["cotizacion_usd", cotizacion]]) {
      if (valor === null) return json(400, { ok: false, message: `${campo} inválido` });
    }

    // Cobrar más que el total casi siempre es un error de tipeo, y queda
    // guardado como un saldo negativo que después nadie entiende.
    if (typeof importe === "number" && typeof anticipo === "number" && anticipo > importe) {
      return json(400, {
        ok: false,
        message: "El anticipo no puede ser mayor que el importe total",
      });
    }

    const payload = { id };
    if (importe !== undefined) payload.importe = importe;
    if (anticipo !== undefined) payload.anticipo = anticipo;
    if (cotizacion !== undefined) payload.cotizacion_usd = cotizacion;
    if (body.facturado !== undefined) {
      payload.facturado = body.facturado === true || String(body.facturado).toLowerCase() === "si"
        ? "si"
        : "no";
    }

    if (Object.keys(payload).length === 1) {
      return json(400, { ok: false, message: "No hay nada para guardar" });
    }

    const out = await callN8n(path, { method: "POST", body: payload, baseUrl, secret });
    return json(200, out);
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
