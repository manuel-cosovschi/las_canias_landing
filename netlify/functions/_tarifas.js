// netlify/functions/_tarifas.js
// El precio de una estadía, calculado del lado del servidor.
//
// La regla ya vivía en tres lados: reservar.html la usa para mostrar el total,
// el nodo Build Price Reply del bot para cotizar por WhatsApp, y el documento
// de reserva para imprimirlo. Ninguno de esos tres puede usarse acá, así que
// esta es la copia del backend — pero una sola, compartida, en vez de una por
// función.
//
// Dos cosas que tienen que seguir igual que en reservar.html, porque si no el
// huésped ve un número y la planilla guarda otro:
//   - "to" es INCLUSIVO: es la última noche que se cobra a ese precio.
//   - una noche sin período cargado no tiene precio, y entonces la estadía
//     entera no se puede cotizar. Inventar un precio de respaldo cobraría de
//     menos sin que nadie se entere.
const { callN8n } = require("./_utils");

const CASAS = ["LC1", "LC2", "LC3", "LC4", "LC5"];

function normalizarPeriodo(p) {
  if (!p || typeof p !== "object") return null;

  const from = String(p.from || "").slice(0, 10);
  const to = String(p.to || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  if (from > to) return null;

  const precios = {};
  for (const c of CASAS) {
    const n = Number((p.prices || {})[c]);
    if (!Number.isFinite(n) || n <= 0) return null;
    precios[c] = n;
  }
  return { from, to, precios };
}

function sumarDias(ymd, n) {
  const partes = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function contarNoches(ci, co) {
  const a = ci.split("-").map(Number);
  const b = co.split("-").map(Number);
  const ms = Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2]);
  return Math.round(ms / 86400000);
}

// Devuelve el total en pesos, o null cuando no se puede cotizar.
function totalEstadia(periodos, checkin, checkout, casa) {
  const esYMD = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!esYMD(checkin) || !esYMD(checkout)) return null;
  if (!CASAS.includes(String(casa || "").toUpperCase())) return null;

  const code = String(casa).toUpperCase();
  const noches = contarNoches(checkin, checkout);
  if (!(noches > 0)) return null;

  let total = 0;
  for (let i = 0; i < noches; i++) {
    const dia = sumarDias(checkin, i);
    const periodo = periodos.find((p) => dia >= p.from && dia <= p.to);
    const precio = periodo && periodo.precios[code];
    if (!Number.isFinite(precio)) return null;
    total += precio;
  }
  return total;
}

// Lee los períodos de la misma data table que editan los dueños desde el panel.
// Devuelve [] si no se pueden leer: quien llame decide qué hacer con eso.
async function leerPeriodos() {
  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_GET_PRICE_PERIODS_PATH || "/webhook/get-price-periods";
  if (!baseUrl || !secret) return [];

  const out = await callN8n(path, { method: "GET", baseUrl, secret });
  const crudos = Array.isArray(out && out.periods) ? out.periods : [];
  const periodos = crudos.map(normalizarPeriodo);

  // Un período ilegible no se descarta en silencio: esas fechas quedarían sin
  // precio y la estadía se cobraría mal.
  if (periodos.some((p) => p === null)) return [];

  return periodos.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

module.exports = { leerPeriodos, totalEstadia, normalizarPeriodo, CASAS };
