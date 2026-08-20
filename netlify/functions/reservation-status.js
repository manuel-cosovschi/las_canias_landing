// /netlify/functions/reservation-status.js
// Público: el huésped consulta el estado de SU reserva desde reservar.html
// (reservar.html lo llama en /api/reservation-status mientras el HOLD está vivo).
//
// Este endpoint NO pide secret, así que sólo devuelve estado y vencimiento.
// Nunca nombre, email, teléfono ni DNI, aunque n8n los mande en la respuesta.
const { json, callN8n } = require("./_utils");

// Valores que usa la planilla de reservas (HOLD_TRANSFER es el estado inicial
// que escribe create-reservation; CONFIRMED lo escribe owner-approve).
const ALLOWED_STATUS = [
  "HOLD",
  "HOLD_TRANSFER",
  "PENDING",
  "PROOF_SENT",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
];

// n8n puede devolver la fila suelta o envuelta; buscamos el estado en los
// lugares habituales y sólo aceptamos valores conocidos.
function pickStatus(out) {
  const raw =
    out?.status ??
    out?.row?.status ??
    out?.data?.status ??
    out?.reservation?.status;

  const s = String(raw || "").trim().toUpperCase();
  return ALLOWED_STATUS.includes(s) ? s : "";
}

function pickExpiresAt(out) {
  return (
    out?.expires_at ??
    out?.row?.expires_at ??
    out?.data?.expires_at ??
    out?.reservation?.expires_at ??
    null
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  // El workflow reservation-status valida la misma clave que el resto de los
  // webhooks de dueño. Nunca llega al navegador: sólo se usa Netlify -> n8n.
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_RESERVATION_STATUS_PATH;

  // Mientras no esté configurado el webhook en n8n devolvemos 404 a propósito:
  // la página corta el polling ante un 404 en vez de reintentar cada 15s.
  if (!baseUrl || !secret || !path) {
    return json(404, { ok: false, message: "Consulta de estado no configurada" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const id = String(body.id || "").trim();
    if (!id) return json(400, { ok: false, message: "Falta id" });

    const out = await callN8n(path, { method: "POST", body: { id }, baseUrl, secret });

    const status = pickStatus(out);

    // Si no pudimos leer un estado conocido respondemos 200 sin status: el
    // cliente sigue consultando. Cortar acá dejaría una reserva real sin
    // actualizarse nunca por culpa de una respuesta puntual rara.
    if (!status) return json(200, { ok: false, message: "Estado no disponible" });

    return json(200, { ok: true, status, expires_at: pickExpiresAt(out) });
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
