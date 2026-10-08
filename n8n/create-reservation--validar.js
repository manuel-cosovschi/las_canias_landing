// Copia versionada del nodo "Code in JavaScript" del workflow
// `create-reservation` de n8n (id H1EzYDegrDOLRAfW).
//
// **Si cambiás esto, cambialo también en n8n**, y al revés. Está acá porque n8n
// no se versiona en ningún lado y los dos bugs más caros de este sistema
// vivieron meses dentro de un nodo que no se podía leer desde el repo.
//
// Qué hace: valida una solicitud de reserva antes de escribirla en la planilla.
// Dos cosas cambiaron respecto de la versión anterior:
//
//   1. Valida el secret. Netlify manda `x-lc-secret` en cada pedido (ver
//      callN8n en netlify/functions/_utils.js) y nadie lo leía: el webhook
//      aceptaba cualquier POST de cualquiera, y cada POST bloquea una casa
//      6 horas.
//
//   2. Las reglas del calendario salen de /api/calendar-config, que es la
//      misma respuesta que lee reservar.html. Antes estaban hardcodeadas acá
//      y ya no coincidían con lo que editan los dueños desde el panel: las
//      ventanas fijas que cargaran para 2027 la página las iba a respetar y
//      este guard no.

// ✅ Tomar SIEMPRE el request del nodo Webhook (no del $json actual)
const wh = $items("Webhook")?.[0]?.json || {};
const body = wh.body || wh;
const headers = wh.headers || {};

// ---------------------------------------------------------------------------
// 1) Secret
// ---------------------------------------------------------------------------
// **El valor real está en el nodo de n8n, no acá**, y es la única línea en la
// que esta copia difiere a propósito del nodo publicado. Este repo es público.
//
// Queda hardcodeado dentro de n8n porque n8n Cloud no expone $env en los nodos
// Code; es el mismo criterio que ya usaban owner-cancel y Owner - Cancel
// Reservation. Si se rota el secret hay que cambiarlo en cada workflow que lo
// valide **más** la env var de Netlify.
//
// Si alguien pega este archivo tal cual en n8n, el flujo de reservas se corta
// entero y en seguida: ninguna solicitud va a traer este valor. Es a propósito
// que falle así y no al revés.
const EXPECTED_SECRET = "__SECRET_REAL_EN_EL_NODO_DE_N8N__";

const secretRecibido = String(
  headers["x-lc-secret"] ??
  headers["X-LC-SECRET"] ??
  headers["X-Lc-Secret"] ??
  ""
).trim();

if (secretRecibido !== EXPECTED_SECRET) {
  return [{ json: { ok: false, message: "No autorizado." } }];
}

// ✅ Headers para quiet hours / test-mode
const isTestMode =
  String(headers["x-test-mode"] || headers["X-Test-Mode"] || "").toLowerCase() === "true";

// ✅ Rows vienen del nodo de Google Sheets
let sheetItems = [];
try {
  sheetItems = $items("Get row(s) in sheet") || [];
} catch (e) {
  sheetItems = [];
}
const rows = sheetItems.map(i => i.json);

// ---- helpers ----
const normYMD = (v) => String(v || "").slice(0, 10);
const esYMD = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

const toUTCms = (ymd) => {
  const s = normYMD(ymd);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d);
};

const sumarDias = (ymd, n) => {
  const t = toUTCms(ymd);
  if (!Number.isFinite(t)) return "";
  return new Date(t + n * 86400000).toISOString().slice(0, 10);
};

const nightsBetween = (startYmd, endYmd) => {
  const t1 = toUTCms(startYmd);
  const t2 = toUTCms(endYmd);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return NaN;
  return Math.round((t2 - t1) / 86400000);
};

const overlaps = (ciStart, ciEnd, aStart, aEnd) => {
  const A = toUTCms(ciStart);
  const B = toUTCms(ciEnd);
  const C = toUTCms(aStart);
  const D = toUTCms(aEnd);
  if (![A, B, C, D].every(Number.isFinite)) return false;
  return A < D && B > C; // [A,B) solapa [C,D)
};

// ---------------------------------------------------------------------------
// 2) Reglas del calendario
// ---------------------------------------------------------------------------
// Se lee la respuesta ya traducida de /api/calendar-config en vez de la data
// table cruda, para que la página y este guard no tengan dos interpretaciones
// de la misma tabla. La normalización es la misma que normalizeCalendarConfig
// en reservar.html, incluido el criterio de que **una regla ilegible invalida
// toda la config**: ese finde quedaría suelto y nadie se enteraría hasta ver
// la reserva hecha.
function normalizarConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return null;

  const lastDate = normYMD(cfg.last_date);
  if (!esYMD(lastDate)) return null;

  const firstDate = normYMD(cfg.first_date);
  if (cfg.first_date && !esYMD(firstDate)) return null;

  const min = Number(cfg.default_min_nights);
  if (!Number.isInteger(min) || min < 1 || min > 30) return null;

  const fixedWindows = [];
  for (const w of (Array.isArray(cfg.fixed_windows) ? cfg.fixed_windows : [])) {
    const ci = normYMD(w && w.checkin);
    const co = normYMD(w && w.checkout);
    if (!esYMD(ci) || !esYMD(co)) return null;
    if (toUTCms(ci) >= toUTCms(co)) return null;
    fixedWindows.push({ checkin: ci, checkout: co });
  }

  const minRules = [];
  for (const r of (Array.isArray(cfg.min_nights_rules) ? cfg.min_nights_rules : [])) {
    const from = normYMD(r && r.from);
    const to = normYMD(r && r.to);
    const n = Number(r && r.nights);
    if (!esYMD(from) || !esYMD(to)) return null;
    if (toUTCms(from) > toUTCms(to)) return null;
    if (!Number.isInteger(n) || n < 1 || n > 30) return null;
    minRules.push({ from, to, nights: n });
  }

  return {
    firstDate: cfg.first_date ? firstDate : "",
    lastDate,
    defaultMinNights: min,
    fixedWindows,
    minRules,
  };
}

let cfgCrudo = null;
try {
  const item = $items("Leer reglas del calendario")?.[0]?.json;
  if (item && item.ok !== false) cfgCrudo = item.config;
} catch (e) {
  cfgCrudo = null;
}

const cfgLeida = normalizarConfig(cfgCrudo);

// Si no se pudo leer, se usan las reglas que estaban hardcodeadas acá. No se
// corta la reserva: la página tampoco carga sin esa misma config, así que un
// pedido legítimo no llega hasta acá con el endpoint caído, y cortar dejaría
// la web sin poder reservar por una falla de red.
const CFG = cfgLeida || {
  firstDate: "",
  lastDate: "",            // sin tope, como venía
  defaultMinNights: 2,
  fixedWindows: [
    { checkin: "2026-10-09", checkout: "2026-10-12" },
    { checkin: "2026-11-20", checkout: "2026-11-23" },
    { checkin: "2026-12-04", checkout: "2026-12-08" },
  ],
  minRules: [],
};

if (!cfgLeida) {
  console.warn("create-reservation: no se pudieron leer las reglas del calendario, usando las de respaldo");
}

// ---- reglas por casa (no están en config_calendario) ----
const FIRST_ALLOWED_BY_HOUSE = {
  LC1: "2026-03-01",
  LC2: "2026-03-01",
  LC3: "2026-03-01",
  LC4: "2026-03-01",
  LC5: "2026-03-07",
};

const HOUSE_RULES = {
  LC1: { max: 4 },
  LC2: { max: 4 },
  LC3: { max: 6 },
  LC4: { max: 4 },
  LC5: { max: 3 },
};

const findFixedByCheckin = (ci) => CFG.fixedWindows.find(w => w.checkin === ci) || null;
const findFixedOverlap = (ci, co) => {
  if (!ci || !co) return null;
  return CFG.fixedWindows.find(w => overlaps(ci, co, w.checkin, w.checkout)) || null;
};

// El mínimo de noches de un tramo pisa al mínimo general, igual que en la página.
const minNightsFor = (ci) => {
  const t = toUTCms(ci);
  const regla = CFG.minRules.find(r => t >= toUTCms(r.from) && t <= toUTCms(r.to));
  return regla ? regla.nights : CFG.defaultMinNights;
};

// ---- fields (aceptar ambas variantes) ----
const house = body.house_code;
const checkinRaw = body.checkin || body.check_in;
const checkoutRaw = body.checkout || body.check_out;

const checkin = normYMD(checkinRaw);
const checkout = normYMD(checkoutRaw);

const guestsNum = Number(body.guests);

// normalizar payment_method (acepta TRANSFER, transferencia, etc.)
const pmRaw = String(body.payment_method || "").trim().toLowerCase();
let pm = pmRaw;
if (["transfer", "transferencia", "bank_transfer", "wire"].includes(pmRaw)) pm = "transfer";
if (["card", "tarjeta", "mp", "mercadopago"].includes(pmRaw)) pm = "card";

// ---- quiet hours (Argentina) ----
// Bloquear SOLO transfer entre 23:00 y 04:00 ARG
// Permitir bypass si viene header: x-test-mode=true
if (pm === "transfer" && !isTestMode) {
  const nowArg = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hourArg = nowArg.getUTCHours();
  const inQuietHours = (hourArg >= 23) || (hourArg < 4);

  if (inQuietHours) {
    return [{
      json: {
        ok: false,
        message: "Fuera de horario operativo (transfer). Probá nuevamente luego de las 04:00.",
      }
    }];
  }
}

// ---- validación mínima ----
const missing = [];
if (!house) missing.push("house_code");
if (!checkinRaw) missing.push("checkin/check_in");
if (!checkoutRaw) missing.push("checkout/check_out");
if (!Number.isFinite(guestsNum) || guestsNum <= 0) missing.push("guests");
if (!body.guest_name) missing.push("guest_name");
if (!body.dni) missing.push("dni");
if (!body.email) missing.push("email");
if (!body.phone) missing.push("phone");
if (!body.payment_method) missing.push("payment_method");

if (missing.length) {
  return [{ json: { ok: false, message: `Faltan campos: ${missing.join(", ")}` } }];
}

// ---- validar reglas por casa ----
const minAllowed = FIRST_ALLOWED_BY_HOUSE[house];
if (!minAllowed) return [{ json: { ok: false, message: "Casa inválida." } }];

if (toUTCms(checkin) < toUTCms(minAllowed)) {
  return [{ json: { ok: false, message: `Esta casa está disponible a partir de ${minAllowed}.` } }];
}

const maxGuests = HOUSE_RULES[house]?.max;
if (Number.isFinite(maxGuests) && guestsNum > maxGuests) {
  return [{ json: { ok: false, message: `Máximo ${maxGuests} personas para ${house}.` } }];
}

// ---- validar fechas ----
const nights = nightsBetween(checkin, checkout);
if (!Number.isFinite(nights)) {
  return [{ json: { ok: false, message: "Fechas inválidas: formato esperado YYYY-MM-DD." } }];
}
if (nights <= 0) {
  return [{ json: { ok: false, message: "Fechas inválidas: check-out debe ser posterior al check-in." } }];
}

// ---- validar la ventana de reservas ----
// Esto antes no existía del lado del servidor: el panel limita hasta cuándo se
// puede reservar y sólo la página lo respetaba.
if (CFG.firstDate && toUTCms(checkin) < toUTCms(CFG.firstDate)) {
  return [{ json: { ok: false, message: `Se puede reservar a partir del ${CFG.firstDate}.` } }];
}

if (CFG.lastDate) {
  // El check-out puede ser la mañana siguiente al último día habilitado, así
  // la última noche también se puede reservar. Mismo criterio que la página.
  const checkoutCutoff = sumarDias(CFG.lastDate, 1);
  if (toUTCms(checkin) > toUTCms(CFG.lastDate) || toUTCms(checkout) > toUTCms(checkoutCutoff)) {
    return [{ json: { ok: false, message: `Por ahora se reserva hasta el ${CFG.lastDate}. Para fechas posteriores consultá por WhatsApp.` } }];
  }
}

// ---- validar ventanas fijas ----
const overlapFixed = findFixedOverlap(checkin, checkout);
if (overlapFixed) {
  const isExact = (checkin === overlapFixed.checkin && checkout === overlapFixed.checkout);
  if (!isExact) {
    return [{
      json: {
        ok: false,
        message: `Fechas fijas: ${overlapFixed.checkin} → ${overlapFixed.checkout}. Para excepciones consultá por WhatsApp.`
      }
    }];
  }
} else {
  const fixedByCi = findFixedByCheckin(checkin);
  if (fixedByCi && checkout !== fixedByCi.checkout) {
    return [{
      json: {
        ok: false,
        message: `Fechas fijas: ${fixedByCi.checkin} → ${fixedByCi.checkout}. Debés reservar exactamente ese rango.`
      }
    }];
  }

  const minNights = minNightsFor(checkin);
  if (nights < minNights) {
    return [{ json: { ok: false, message: `La estadía mínima es de ${minNights} noches.` } }];
  }
}

// ---- conflictos con sheet ----
const nowMs = Date.now();

const isBlocking = (r) => {
  const st = String(r.status || "").trim().toUpperCase();

  if (st === "CONFIRMED") return true;

  if (st === "HOLD_TRANSFER" || st === "PENDING_TRANSFER_CONFIRMATION") {
    const exp = String(r.expires_at || "").trim();
    const expMs = exp ? Date.parse(exp) : NaN;
    return Number.isFinite(expMs) && expMs > nowMs;
  }

  if (st === "PENDING_PAYMENT") return true;

  return false;
};

const conflicts = rows
  .filter(r => r.house_code === house)
  .filter(r => isBlocking(r))
  .filter(r => r.check_in && r.check_out)
  .filter(r => overlaps(checkin, checkout, normYMD(r.check_in), normYMD(r.check_out)));

if (conflicts.length) {
  return [{
    json: {
      ok: false,
      message: "Fechas no disponibles (ya reservadas).",
      conflicts: conflicts.map(c => ({
        id: c.id,
        check_in: normYMD(c.check_in),
        check_out: normYMD(c.check_out),
        status: c.status,
        expires_at: c.expires_at || ""
      }))
    }
  }];
}

// ---- generar id ----
const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const id = `R-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Math.random().toString(16).slice(2,6).toUpperCase()}`;

// ---- status + expires ----
let status = "PENDING_PAYMENT";
let expires_at = "";
let approved_at = "";
let cancelled_at = "";
let status_reason = "";

if (pm === "transfer") {
  status = "HOLD_TRANSFER";
  expires_at = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
}

return [{
  json: {
    ok: true,
    row: {
      id,
      created_at: now.toISOString(),
      status,
      source: "web",
      house_code: house,
      check_in: checkin,
      check_out: checkout,
      guest_name: body.guest_name,
      dni: body.dni,
      email: body.email,
      phone: body.phone,
      guests: guestsNum,
      payment_method: pm,
      payment_ref: body.payment_ref || "",
      notes: body.notes || "",
      expires_at,
      approved_at,
      cancelled_at,
      status_reason
    }
  }
}];
