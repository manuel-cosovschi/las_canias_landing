const { assertAuth, json, callN8n } = require("./_utils");

// Acciones del panel sobre una conversación de WhatsApp: pausar el bot para ese
// contacto, reanudarlo, o responderle a mano como Las Cañas.
//
// El path va con valor por defecto en el código en vez de gastar una variable
// de entorno: el sitio ya está cerca del límite de 4KB que AWS Lambda impone
// sobre las env vars, y este path no es un secreto (ver README).
const DEFAULT_PATH = "/webhook/wa-panel-accion";

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { message: "El pedido no es JSON válido" });
  }

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const ownerSecret = process.env.LC_OWNER_SECRET;
    const path = process.env.N8N_WA_ACTION_PATH || DEFAULT_PATH;

    if (!baseUrl || !ownerSecret) {
      return json(500, {
        message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET",
      });
    }

    const out = await callN8n(path, {
      method: "POST",
      body,
      baseUrl,
      secret: ownerSecret,
    });

    return json(200, out);
  } catch (e) {
    // n8n contesta 400 cuando WhatsApp rechaza el envío (el caso típico es la
    // ventana de 24 hs). Sin conservar el código y el cuerpo, el panel no podría
    // explicarle al dueño por qué no salió el mensaje.
    return json(e.status || 500, e.payload || { message: e.message || "Error" });
  }
};
