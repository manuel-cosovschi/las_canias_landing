// netlify/functions/owner-blocks.js
//
// Bloquea fechas: las saca de la venta. Dos casos que se ven igual en el
// calendario pero no en los números:
//
//   - Mantenimiento, arreglos, uso de la familia: no hay plata detrás.
//   - Una reserva que entró por WhatsApp o teléfono. Los dueños la cargan como
//     bloqueo, así que la fila tiene que poder llevar el huésped y el importe
//     — si no, esa reserva no existe para la sección Números.
//
// El chequeo de solape lo hace n8n, que es el único que ve la planilla entera.
// Antes se hacía acá contra el endpoint público de disponibilidad, que no ve
// los estados y daba un mensaje sin decir con qué se pisaba.

const { assertAuth, json, callN8n } = require("./_utils");

const CASAS = ["LC1", "LC2", "LC3", "LC4", "LC5"];
const ES_YMD = /^\d{4}-\d{2}-\d{2}$/;

function aYMD(v) {
  const s = String(v || "").trim();
  if (ES_YMD.test(s)) return s;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

// Vacío queda vacío: un bloqueo de mantenimiento no tiene importe, y un cero
// no es lo mismo que "no hay dato".
function monto(v) {
  if (v === undefined || v === null || String(v).trim() === "") return "";
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_CREATE_MANUAL_PATH || "/webhook/create-manual-reservation";

  if (!baseUrl || !secret) {
    return json(500, { message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const house_code = String(body.house_code || "").trim().toUpperCase();
    if (!CASAS.includes(house_code)) return json(400, { message: "Elegí una casa" });

    const check_in = aYMD(body.checkin || body.check_in);
    const check_out = aYMD(body.checkout || body.check_out);
    if (!check_in || !check_out) return json(400, { message: "Faltan las fechas" });
    if (check_out <= check_in) {
      return json(400, { message: "Check-out debe ser posterior al check-in" });
    }

    const importe = monto(body.importe);
    const anticipo = monto(body.anticipo);
    const cotizacion_usd = monto(body.cotizacion_usd);
    if (importe === null) return json(400, { message: "Importe inválido" });
    if (anticipo === null) return json(400, { message: "Seña inválida" });
    if (cotizacion_usd === null) return json(400, { message: "Cotización inválida" });

    // Cobrar más que el total casi siempre es un error de tipeo, y queda
    // guardado como un saldo negativo que después nadie entiende.
    if (importe !== "" && anticipo !== "" && anticipo > importe) {
      return json(400, { message: "La seña no puede ser mayor que el importe total" });
    }

    const fac = String(body.facturado || "").trim().toLowerCase();

    const out = await callN8n(path, {
      method: "POST",
      body: {
        status: "BLOCKED",
        house_code, check_in, check_out,
        guest_name: String(body.guest_name || "").trim(),
        phone: String(body.phone || "").trim(),
        dni: String(body.dni || "").trim(),
        importe, anticipo, cotizacion_usd,
        facturado: fac === "si" || fac === "no" ? fac : "",
        note: String(body.note || "").slice(0, 200),
      },
      baseUrl,
      secret,
    });

    return json(200, out);
  } catch (e) {
    // n8n contesta 409 cuando las fechas se pisan, diciendo con qué. Sin
    // conservar el código, el panel no puede distinguir "está ocupado" de
    // "se cayó algo".
    const status = Number.isFinite(e.status) ? e.status : 500;
    return json(status, e.payload || { message: e.message || "Error" });
  }
};
