// /netlify/functions/set-reservation-guest.js
//
// Carga o corrige los datos del huésped de una fila que ya existe: nombre,
// teléfono, mail, DNI y notas.
//
// Hasta ahora no había forma de hacerlo. admin-update-reservation sólo cambia
// el estado, y set-reservation-payment sólo toca la plata. El agujero se veía
// en los bloqueos: si el dueño bloqueaba unas fechas sin cargar quién era, esa
// fila se quedaba sin nombre para siempre y el calendario mostraba "-".
//
// Mismo criterio que set-reservation-payment: un campo ausente no se toca, uno
// en "" se borra. Así el panel puede guardar sólo lo que el dueño editó sin
// pisar el resto de la fila.
const { assertAuth, json, callN8n } = require("./_utils");

const CAMPOS = ["guest_name", "phone", "email", "dni", "notes"];

// Topes generosos: son datos que escribe el dueño a mano, no algo que llegue
// de afuera. Lo que se evita es que un pegado accidental de media pantalla
// termine adentro de una celda de la planilla.
const LARGO = { guest_name: 120, phone: 40, email: 120, dni: 30, notes: 500 };

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_SET_GUEST_PATH || "/webhook/set-reservation-guest";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const id = String(body.id || "").trim();
    if (!id) return json(400, { ok: false, message: "Falta id" });

    const payload = { id };
    for (const campo of CAMPOS) {
      if (body[campo] === undefined) continue;
      const valor = String(body[campo] ?? "").trim();
      if (valor.length > LARGO[campo]) {
        return json(400, { ok: false, message: `${campo}: máximo ${LARGO[campo]} caracteres` });
      }
      payload[campo] = valor;
    }

    if (Object.keys(payload).length === 1) {
      return json(400, { ok: false, message: "No hay nada para guardar" });
    }

    const out = await callN8n(path, { method: "POST", body: payload, baseUrl, secret });
    return json(200, out);
  } catch (e) {
    // n8n contesta 404 cuando el id no existe. Sin conservar el código, el
    // panel no puede distinguir "esa reserva no está" de "se cayó algo".
    const status = Number.isFinite(e.status) ? e.status : 500;
    return json(status, e.payload || { ok: false, message: e.message || "Error" });
  }
};
