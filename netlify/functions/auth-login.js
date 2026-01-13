const { json } = require("./_utils");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const { username, password } = JSON.parse(event.body || "{}");

    const USER = process.env.ADMIN_USER;
    const PASS = process.env.ADMIN_PASS;
    const OWNER_SECRET = process.env.LC_OWNER_SECRET;

    if (!USER || !PASS || !OWNER_SECRET) {
      return json(500, { message: "Faltan env vars (ADMIN_USER, ADMIN_PASS, LC_OWNER_SECRET)" });
    }

    if (String(username || "") !== USER || String(password || "") !== PASS) {
      return json(401, { message: "Usuario o contraseña incorrectos" });
    }

    // Si credenciales ok, devolvemos la clave que ya usan tus funciones (LC_OWNER_SECRET)
    return json(200, { ok: true, owner_secret: OWNER_SECRET });
  } catch (e) {
    return json(400, { message: "Body inválido" });
  }
};