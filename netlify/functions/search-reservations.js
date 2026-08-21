// netlify/functions/search-reservations.js
// Buscador del panel: cualquier reserva de la planilla, en cualquier estado.
//
// Las listas que ya existían (list-pending, list-confirmed) muestran una
// ventana chica: pendientes vivas y confirmadas. Cuando el dueño necesita
// encontrar "la reserva de Pérez de enero" o ver por qué una se canceló, no
// tenía dónde. Esto lee la planilla completa y filtra.
const { assertAuth, json } = require("./_utils");
const { readAllRows, verifyAdminAuth, asISODate } = require("./_sheet");

const CAMPOS = [
  "id", "status", "source", "house_code", "check_in", "check_out",
  "guest_name", "dni", "email", "phone", "guests",
  "payment_method", "payment_ref", "notes",
  "created_at", "expires_at", "approved_at", "cancelled_at", "status_reason",
];

// Lo que se puede escribir en el buscador libre
const CAMPOS_TEXTO = ["id", "guest_name", "phone", "email", "dni", "payment_ref", "notes", "house_code"];

const LIMITE_DEFAULT = 100;
const LIMITE_MAX = 500;

function normalizar(row) {
  const out = {};
  for (const c of CAMPOS) out[c] = row[c] == null ? "" : String(row[c]).trim();

  out.status = out.status.toUpperCase();
  out.house_code = out.house_code.toUpperCase();
  out.check_in = asISODate(out.check_in) || out.check_in;
  out.check_out = asISODate(out.check_out) || out.check_out;

  return out;
}

// Tolerante a mayúsculas y acentos: "peña" tiene que encontrarse escribiendo "pena"
function plano(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function coincideTexto(row, q) {
  if (!q) return true;
  const aguja = plano(q);
  for (const c of CAMPOS_TEXTO) {
    if (plano(row[c]).includes(aguja)) return true;
  }
  return false;
}

// La reserva entra si la estadía toca el rango pedido. check_out es exclusivo:
// alguien que se va el 10 no ocupa la noche del 10.
function coincideRango(row, from, to) {
  if (!from && !to) return true;
  const ci = row.check_in;
  const co = row.check_out;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ci) || !/^\d{4}-\d{2}-\d{2}$/.test(co)) return false;
  if (from && co <= from) return false;
  if (to && ci > to) return false;
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-lc-secret",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") return json(405, { ok: false, message: "Method not allowed" });

  if (!verifyAdminAuth(event.headers)) return json(401, { ok: false, message: "No autorizado" });
  if (!assertAuth(event)) return json(403, { ok: false, message: "Falta x-lc-secret" });

  try {
    const p = event.queryStringParameters || {};

    const q = String(p.q || "").trim();
    const status = String(p.status || "").trim().toUpperCase();
    const house = String(p.house_code || "").trim().toUpperCase();
    const from = String(p.from || "").trim();
    const to = String(p.to || "").trim();

    const pedido = Number(p.limit);
    const limit = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, LIMITE_MAX) : LIMITE_DEFAULT;

    const filas = (await readAllRows()).map(normalizar).filter((r) => r.id);

    const encontradas = filas.filter((r) => {
      if (status && r.status !== status) return false;
      if (house && r.house_code !== house) return false;
      if (!coincideRango(r, from, to)) return false;
      return coincideTexto(r, q);
    });

    // Más nuevas primero: lo que se busca suele ser lo que está por venir
    encontradas.sort((a, b) => (a.check_in < b.check_in ? 1 : a.check_in > b.check_in ? -1 : 0));

    return json(200, {
      ok: true,
      total: encontradas.length,
      count: Math.min(encontradas.length, limit),
      truncated: encontradas.length > limit,
      items: encontradas.slice(0, limit),
    });
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
