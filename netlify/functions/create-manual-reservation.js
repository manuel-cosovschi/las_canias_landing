// netlify/functions/create-manual-reservation.js
//
// Carga una reserva a mano desde el panel: la que entró por teléfono o
// WhatsApp y nunca pasó por la web. Es la fila que antes escribían en el Excel.
//
// No confundir con create-reservation, que es el alta pública: aquella nace
// PENDING y con vencimiento, ésta nace CONFIRMED porque el dueño ya sabe que
// está cerrada. Y no manda ningún mail: el huésped ya arregló por otro lado.
//
// El chequeo de solape lo hace n8n, que es el único que ve la planilla entera.

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

// Vacío queda vacío: una reserva puede cargarse sin el importe todavía.
function monto(v) {
  if (v === undefined || v === null || String(v).trim() === "") return "";
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_CREATE_MANUAL_PATH || "/webhook/create-manual-reservation";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const house_code = String(body.house_code || "").trim().toUpperCase();
    if (!CASAS.includes(house_code)) {
      return json(400, { ok: false, message: "Elegí una casa" });
    }

    const check_in = aYMD(body.check_in || body.checkin);
    const check_out = aYMD(body.check_out || body.checkout);
    if (!check_in || !check_out) {
      return json(400, { ok: false, message: "Faltan las fechas" });
    }
    if (check_out <= check_in) {
      return json(400, { ok: false, message: "La salida tiene que ser posterior a la entrada" });
    }

    const guest_name = String(body.guest_name || "").trim();
    if (!guest_name) return json(400, { ok: false, message: "Falta el nombre del huésped" });

    const importe = monto(body.importe);
    const anticipo = monto(body.anticipo);
    if (importe === null) return json(400, { ok: false, message: "Importe inválido" });
    if (anticipo === null) return json(400, { ok: false, message: "Seña inválida" });

    // Cobrar más que el total casi siempre es un error de tipeo, y queda
    // guardado como un saldo negativo que después nadie entiende.
    if (importe !== "" && anticipo !== "" && anticipo > importe) {
      return json(400, { ok: false, message: "La seña no puede ser mayor que el importe total" });
    }

    const out = await callN8n(path, {
      method: "POST",
      body: {
        house_code, check_in, check_out, guest_name,
        dni: String(body.dni || "").trim(),
        phone: String(body.phone || "").trim(),
        email: String(body.email || "").trim(),
        importe, anticipo,
      },
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
