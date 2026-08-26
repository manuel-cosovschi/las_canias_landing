// netlify/functions/list-calendar.js
// Devuelve eventos para calendario: CONFIRMED / HOLD_TRANSFER / BLOCKED
// Requiere Basic Auth + x-lc-secret, y lee la sheet "reservas" (tu estructura actual).

const { readAllRows } = require("./_sheet");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function decodeBasic(authHeader) {
  // "Basic base64(user:pass)"
  try {
    const [kind, token] = String(authHeader || "").split(" ");
    if (kind !== "Basic" || !token) return null;
    const raw = Buffer.from(token, "base64").toString("utf8");
    const i = raw.indexOf(":");
    if (i < 0) return null;
    return { user: raw.slice(0, i), pass: raw.slice(i + 1), token };
  } catch {
    return null;
  }
}

function verifyAdminAuth(headers) {
  const a = headers.authorization || headers.Authorization;
  const parsed = decodeBasic(a);
  if (!parsed) return false;

  // 1) comparar token base64 directo (si lo usás)
  const ENV_BASIC =
    process.env.LC_ADMIN_BASIC ||
    process.env.ADMIN_BASIC ||
    process.env.ADMIN_AUTH_BASIC;

  if (ENV_BASIC) return parsed.token === ENV_BASIC;

  // 2) comparar user/pass (tu caso actual en Netlify)
  const ENV_USER = process.env.LC_ADMIN_USER || process.env.ADMIN_USER;
  const ENV_PASS = process.env.LC_ADMIN_PASS || process.env.ADMIN_PASS;

  if (ENV_USER && ENV_PASS) return parsed.user === ENV_USER && parsed.pass === ENV_PASS;

  return false;
}

function verifyOwnerSecret(headers) {
  const got = headers["x-lc-secret"] || headers["X-LC-SECRET"] || headers["X-Lc-Secret"];
  const want = process.env.LC_OWNER_SECRET;
  if (!want) return false;
  return String(got || "") === String(want);
}

function asISODate(v) {
  // Soporta Date, "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ssZ", etc.
  if (!v) return null;

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const d = new Date(v);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  const s = String(v).trim();
  if (!s) return null;

  // Si viene tipo "2026-04-30 00:00:00" (Sheets), lo convertimos
  const s2 = s.includes(" ") && !s.includes("T") ? s.replace(" ", "T") : s;
  const ms = Date.parse(s2);
  if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);

  // fallback: si ya parece YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return null;
}

function normalizeRow(obj) {
  const row = { ...obj };

  row.id = (row.id || row.ID || row.Id || "").toString().trim();
  row.status = (row.status || row.STATUS || "").toString().trim();
  row.house_code = (row.house_code || row.house || row.casa || "").toString().trim();
  row.check_in = (row.check_in || row.checkin || "").toString().trim();
  row.check_out = (row.check_out || row.checkout || "").toString().trim();

  return row;
}

const HOUSE_NAMES = {
  LC1: "Las Cañas 1",
  LC2: "Las Cañas 2",
  LC3: "Las Cañas 3",
  LC4: "Las Cañas 4",
  LC5: "Las Cañas 5",
};

// El calendario muestra el nombre completo; si aparece un código nuevo que no
// está en el mapa, mostramos el código crudo antes que dejar el evento sin
// identificar.
function houseName(code) {
  const key = String(code || "").trim().toUpperCase();
  return HOUSE_NAMES[key] || String(code || "").trim();
}

// La lectura sale de _sheet.js, no de una copia acá. Esta función tenía su
// propio `A:Z` y sobrevivió al arreglo del otro: dos copias del mismo código
// terminan leyendo columnas distintas, que es justo lo que el comentario de
// _sheet.js decía querer evitar.
async function leerFilas() {
  return (await readAllRows()).map(normalizeRow);
}

exports.handler = async (event) => {
  try {
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

    if (event.httpMethod !== "GET") return json(405, { message: "Method Not Allowed" });

    // Seguridad
    if (!verifyAdminAuth(event.headers)) return json(401, { message: "No autorizado (Basic inválido)." });
    if (!verifyOwnerSecret(event.headers)) return json(403, { message: "Forbidden: falta x-lc-secret" });

    const rows = await leerFilas();

    // Solo los estados que querés ver sí o sí en calendario
    const allowed = new Set(["CONFIRMED", "HOLD_TRANSFER", "BLOCKED"]);

    const filtered = rows.filter(r => {
    const st = String(r.status || "").trim().toUpperCase();
    return allowed.has(st);
    });

    const events = filtered
      .map(r => {
        const start = asISODate(String(r.check_in || "").trim());
        const end   = asISODate(String(r.check_out || "").trim());
        const house = String(r.house_code || "").trim();
        if (!start || !end || !house) return null;

        const status = String(r.status || "").trim().toUpperCase();
        const name = houseName(house);

        // title corto; el detalle completo va en extendedProps
        const title =
          status === "CONFIRMED" ? `${name} · Confirmada`
          : status === "HOLD_TRANSFER" ? `${name} · Hold`
          : `${name} · Bloqueada`;

        // Sin colores acá a propósito: el calendario pinta cada evento con el
        // color de su casa, y esa paleta vive en admin.html (una sola fuente).
        return {
          id: String(r.id || `${r.house_code}-${start}-${end}-${status}`),
          title,
          start, // all-day
          end,   // fullcalendar interpreta end como exclusive (perfecto)
          allDay: true,
          extendedProps: {
            house_name: name,
            status,
            house_code: house,
            row: r, // TODA la fila para mostrar en modal
          },
        };
      })
      .filter(Boolean);

    return json(200, {
      count: events.length,
      events,
      statuses: Array.from(allowed),
    });
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};