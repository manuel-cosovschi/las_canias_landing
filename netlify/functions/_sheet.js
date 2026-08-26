// netlify/functions/_sheet.js
// Lectura directa de la planilla "Las Cañas - Reservas" con la service account
// de Google. Es el mismo camino que ya usaba list-calendar: n8n queda para
// escribir, y para leer de a muchas filas vamos derecho a Sheets.
//
// Tener el nombre de la pestaña en un solo lugar evita que dos funciones lean
// columnas distintas cuando la planilla cambia.
//
// Se pide la pestaña entera, sin acotar columnas. Antes decía "A:Z", que corta
// en la 26: las cuatro columnas de plata (importe, anticipo, facturado,
// cotizacion_usd) viven en AA..AD y nunca llegaban. La sección Números salía
// con todo en cero y no había forma de notarlo desde acá, porque las fechas y
// los nombres —que sí entran en A:Z— se veían perfectos.
//
// Sin tope de columnas, lo que promete el comentario de readAllRows es cierto:
// una columna nueva aparece sola.
const { google } = require("googleapis");

function decodeBasic(authHeader) {
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

// El panel manda Basic + x-lc-secret. Esto valida el Basic; el secret de dueño
// lo valida assertAuth de _utils.
function verifyAdminAuth(headers) {
  const parsed = decodeBasic(headers.authorization || headers.Authorization);
  if (!parsed) return false;

  const ENV_BASIC =
    process.env.LC_ADMIN_BASIC ||
    process.env.ADMIN_BASIC ||
    process.env.ADMIN_AUTH_BASIC;

  if (ENV_BASIC) return parsed.token === ENV_BASIC;

  const ENV_USER = process.env.LC_ADMIN_USER || process.env.ADMIN_USER;
  const ENV_PASS = process.env.LC_ADMIN_PASS || process.env.ADMIN_PASS;

  if (ENV_USER && ENV_PASS) return parsed.user === ENV_USER && parsed.pass === ENV_PASS;

  return false;
}

async function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON en env.");
  const creds = JSON.parse(raw);

  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  await jwt.authorize();

  return google.sheets({ version: "v4", auth: jwt });
}

// Devuelve un objeto por fila, con las claves de la primera fila de la planilla.
// Las columnas nuevas aparecen solas: no hay lista fija de campos acá.
async function readAllRows() {
  const spreadsheetId = process.env.LC_SHEET_ID;
  const tab = process.env.LC_SHEET_TAB || "reservas";
  if (!spreadsheetId) throw new Error("Falta LC_SHEET_ID en env.");

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tab,
  });

  const values = res.data.values || [];
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h || "").trim());

  return values.slice(1).map((arr) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      if (headers[i]) obj[headers[i]] = arr[i];
    }
    return obj;
  });
}

// Sheets devuelve fechas en varios formatos según cómo se escribió la celda.
function asISODate(v) {
  if (!v) return null;

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const d = new Date(v);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const s2 = s.includes(" ") && !s.includes("T") ? s.replace(" ", "T") : s;
  const ms = Date.parse(s2);
  if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);

  return null;
}

module.exports = { readAllRows, verifyAdminAuth, asISODate };
