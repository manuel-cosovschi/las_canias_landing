// netlify/functions/set-reservation-dates.js
//
// Mueve una reserva de fechas sin tener que cancelarla y volver a cargarla.
// Lo usa el panel desde el calendario: click en la ocupación → cambiar fechas.
//
// El chequeo de que el nuevo rango no pise otra ocupación de la misma casa lo
// hace n8n, que es el único que ve la planilla entera. Acá sólo validamos la
// forma del pedido, para no gastar una vuelta al webhook por un error de tipeo.

const { assertAuth, json, callN8n } = require("./_utils");

const ES_YMD = /^\d{4}-\d{2}-\d{2}$/;

function aYMD(v) {
  const s = String(v || "").trim();
  if (ES_YMD.test(s)) return s;

  // Por si el panel manda un ISO completo
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_SET_DATES_PATH || "/webhook/set-reservation-dates";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const id = String(body.id || "").trim();
    if (!id) return json(400, { ok: false, message: "Falta id" });

    const checkin = aYMD(body.check_in || body.checkin);
    const checkout = aYMD(body.check_out || body.checkout);

    if (!checkin || !checkout) {
      return json(400, { ok: false, message: "Faltan las fechas (check_in y check_out)" });
    }
    if (checkout <= checkin) {
      return json(400, { ok: false, message: "La salida tiene que ser posterior a la entrada" });
    }

    const out = await callN8n(path, {
      method: "POST",
      body: { id, check_in: checkin, check_out: checkout },
      baseUrl,
      secret,
    });

    return json(200, out);
  } catch (e) {
    // n8n contesta 409 cuando las fechas se pisan. Sin conservar el código, el
    // panel no puede distinguir "esas fechas están ocupadas" de "se cayó algo".
    const status = Number.isFinite(e.status) ? e.status : 500;
    return json(status, e.payload || { ok: false, message: e.message || "Error" });
  }
};
