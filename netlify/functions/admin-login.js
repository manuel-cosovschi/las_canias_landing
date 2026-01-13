const { json } = require("./_utils");

function parseBasicAuth(header) {
  if (!header) return null;
  const [type, value] = header.split(" ");
  if (type !== "Basic" || !value) return null;
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const creds = parseBasicAuth(event.headers.authorization || event.headers.Authorization);
  if (!creds) return json(401, { message: "Unauthorized" });

  const u = process.env.ADMIN_USER;
  const p = process.env.ADMIN_PASS;
  if (!u || !p) return json(500, { message: "Faltan ADMIN_USER / ADMIN_PASS en Netlify" });

  if (creds.user !== u || creds.pass !== p) {
    return json(401, { message: "Usuario/contraseña inválidos" });
  }

  return json(200, { ok: true });
};