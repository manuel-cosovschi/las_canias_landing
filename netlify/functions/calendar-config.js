// /netlify/functions/calendar-config.js
// Público (solo lectura): reservar.html lo consulta para saber hasta cuándo se
// puede reservar, cuál es el mínimo de noches y qué findes van fijos. El panel
// de admin lo usa para poblar el formulario.
//
// Las reglas viven en la data table config_calendario de n8n; el secret se usa
// sólo de Netlify a n8n y nunca llega al navegador.
const { json, callN8n } = require("./_utils");

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function fecha(v) {
  return String(v || "").slice(0, 10);
}

function normalizeFixedWindow(w) {
  if (!w || typeof w !== "object") return null;

  const checkin = fecha(w.checkin);
  const checkout = fecha(w.checkout);
  if (!ES_FECHA.test(checkin) || !ES_FECHA.test(checkout)) return null;
  if (checkin >= checkout) return null;

  return { checkin, checkout, label: String(w.label || "") };
}

function normalizeMinRule(r) {
  if (!r || typeof r !== "object") return null;

  const from = fecha(r.from);
  const to = fecha(r.to);
  if (!ES_FECHA.test(from) || !ES_FECHA.test(to)) return null;
  if (from > to) return null;

  const nights = Number(r.nights);
  if (!Number.isInteger(nights) || nights < 1 || nights > 30) return null;

  return { from, to, nights, label: String(r.label || "") };
}

exports.handler = async () => {
  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  // Igual que en price-periods: el path va por defecto porque las env vars de
  // este sitio ya rozan el límite de 4KB que AWS Lambda impone por función.
  const path = process.env.N8N_GET_CALENDAR_CONFIG_PATH || "/webhook/get-calendar-config";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const out = await callN8n(path, { method: "GET", baseUrl, secret });

    const raw = out && typeof out.config === "object" ? out.config : null;
    if (!raw) {
      return json(502, { ok: false, message: "Respuesta del calendario sin config" });
    }

    // Sin fecha de corte no sabemos hasta cuándo se puede reservar, y sin
    // mínimo no sabemos cuántas noches exigir: en los dos casos preferimos
    // que la página se plante antes que inventar una regla.
    const last_date = fecha(raw.last_date);
    if (!ES_FECHA.test(last_date)) {
      return json(502, { ok: false, message: "Falta la última fecha reservable" });
    }

    const first_date = fecha(raw.first_date);
    if (first_date && !ES_FECHA.test(first_date)) {
      return json(502, { ok: false, message: "Primera fecha reservable ilegible" });
    }

    const default_min_nights = Number(raw.default_min_nights);
    if (!Number.isInteger(default_min_nights) || default_min_nights < 1 || default_min_nights > 30) {
      return json(502, { ok: false, message: "Mínimo de noches ilegible" });
    }

    // Una regla ilegible no se descarta en silencio: si lo hiciéramos, ese
    // finde quedaría reservable suelto o ese tramo perdería su mínimo.
    const fixed_windows = (Array.isArray(raw.fixed_windows) ? raw.fixed_windows : []).map(normalizeFixedWindow);
    const badWindow = fixed_windows.findIndex((w) => w === null);
    if (badWindow !== -1) {
      return json(502, { ok: false, message: "Finde fijo ilegible", index: badWindow });
    }

    const min_nights_rules = (Array.isArray(raw.min_nights_rules) ? raw.min_nights_rules : []).map(normalizeMinRule);
    const badRule = min_nights_rules.findIndex((r) => r === null);
    if (badRule !== -1) {
      return json(502, { ok: false, message: "Regla de mínimo ilegible", index: badRule });
    }

    fixed_windows.sort((a, b) => (a.checkin < b.checkin ? -1 : a.checkin > b.checkin ? 1 : 0));
    min_nights_rules.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({
        ok: true,
        config: { first_date, last_date, default_min_nights, fixed_windows, min_nights_rules },
      }),
    };
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
