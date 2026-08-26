// /netlify/functions/set-season-goal.js
// Acción de dueño: fija el objetivo de facturación de una temporada.
// n8n vuelve a validar antes de escribir; acá sólo cortamos lo que claramente
// no tiene sentido mandar.
const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  const path = process.env.N8N_SET_SEASON_GOAL_PATH || "/webhook/set-objetivo";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    // La temporada se identifica por su año de arranque: la 25-26 es "2025".
    const temporada = String(body.temporada ?? "").trim();
    if (!/^\d{4}$/.test(temporada)) {
      return json(400, { ok: false, message: "Falta la temporada (el año de inicio, por ejemplo 2025)" });
    }

    // 0 es válido y quiere decir "sin objetivo": es cómo se borra.
    const objetivo = Number(body.objetivo);
    if (!Number.isFinite(objetivo) || objetivo < 0) {
      return json(400, { ok: false, message: "El objetivo tiene que ser un número mayor o igual a 0" });
    }

    const out = await callN8n(path, {
      method: "POST",
      body: { temporada, objetivo },
      baseUrl,
      secret,
    });

    if (out && out.ok === false) return json(400, out);

    return json(200, { ok: true, temporada, objetivo });
  } catch (e) {
    // Un 4xx de n8n es un rechazo de validación, no una falla del servidor.
    return json(e.status && e.status < 500 ? e.status : 500, {
      ok: false,
      message: e.message || "Error",
    });
  }
};
