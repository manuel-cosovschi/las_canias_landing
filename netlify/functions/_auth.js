// netlify/functions/_auth.js
// El Basic del panel, y nada más.
//
// Vivía adentro de _sheet.js, que carga googleapis al importarse. Eso está
// bien para las funciones que leen la planilla, pero proof-file sólo necesita
// saber si quien pide es el dueño — y al importarlo desde una función v2 (ESM)
// el bundler dejaba un require("googleapis") sin resolver y la función
// contestaba 502.
//
// Así que la comprobación vive acá, sin dependencias: la usan las funciones
// v1 a través de _sheet.js, que la reexporta, y las v2 importándola derecho.
// Una sola copia, que es lo que corresponde para algo que decide quién entra.
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
// lo valida assertAuth de _utils (v1) o esDueno de _v2 (v2).
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

module.exports = { decodeBasic, verifyAdminAuth };
