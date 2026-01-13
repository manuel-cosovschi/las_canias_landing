const { assertAuth, json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "GET") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    const path = process.env.N8N_OWNER_LIST_PENDING_PATH;

    if (!baseUrl || !secret || !path) {
      return json(500, { message: "Faltan env vars: N8N_BASE_URL / N8N_SECRET / N8N_OWNER_LIST_PENDING_PATH" });
    }

    // OJO: tu workflow es GET, pero callN8n hoy siempre manda JSON.
    // Para mantenerlo simple: hacemos fetch directo GET.
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-lc-secret": secret },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(JSON.stringify({ message: data?.message || "Error list-pending", url, status: res.status, data }));
    }

    // Normalizamos para el dashboard:
    const holds = data.holds || [];
    return json(200, { ok: true, items: holds });
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};