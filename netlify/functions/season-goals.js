// /netlify/functions/season-goals.js
// Acción de dueño (lectura): devuelve el objetivo de facturación de cada
// temporada. A diferencia de price-periods y calendar-config, esto no lo
// necesita la página pública, así que pide el secret.
//
// Los objetivos viven en la data table objetivos_temporada de n8n.
const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "GET") return json(405, { ok: false, message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.LC_OWNER_SECRET;
  // Igual que en price-periods: el path va por defecto para no sumar env vars.
  const path = process.env.N8N_GET_SEASON_GOALS_PATH || "/webhook/get-objetivos";

  if (!baseUrl || !secret) {
    return json(500, { ok: false, message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET" });
  }

  try {
    const out = await callN8n(path, { method: "GET", baseUrl, secret });

    // Se normaliza acá y no en el navegador: un objetivo que llegue como texto
    // ("80000000") rompería la barra de progreso sin decir nada.
    const crudos = out && typeof out.goals === "object" && out.goals ? out.goals : {};
    const goals = {};
    for (const [temporada, valor] of Object.entries(crudos)) {
      const monto = Number(valor);
      if (/^\d{4}$/.test(String(temporada)) && Number.isFinite(monto) && monto > 0) {
        goals[String(temporada)] = monto;
      }
    }

    return json(200, { ok: true, goals });
  } catch (e) {
    return json(e.status && e.status < 500 ? e.status : 500, {
      ok: false,
      message: e.message || "Error",
    });
  }
};
