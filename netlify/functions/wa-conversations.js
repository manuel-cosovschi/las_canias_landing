const { assertAuth, json, callN8n } = require("./_utils");

// Conversaciones del bot de WhatsApp para la sección Conversaciones del panel.
//
// El path va con valor por defecto en el código en vez de gastar una variable
// de entorno: el sitio ya está cerca del límite de 4KB que AWS Lambda impone
// sobre las env vars, y este path no es un secreto (ver README).
const DEFAULT_PATH = "/webhook/get-wa-conversaciones";

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "GET") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const ownerSecret = process.env.LC_OWNER_SECRET;
    const path = process.env.N8N_WA_CONVERSATIONS_PATH || DEFAULT_PATH;

    if (!baseUrl || !ownerSecret) {
      return json(500, {
        message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET",
      });
    }

    const out = await callN8n(path, {
      method: "GET",
      baseUrl,
      secret: ownerSecret,
    });

    return json(200, out);
  } catch (e) {
    // callN8n guarda el código que devolvió n8n: sin esto, un rechazo por
    // validación llegaría al panel como un 500 genérico.
    return json(e.status || 500, e.payload || { message: e.message || "Error" });
  }
};
