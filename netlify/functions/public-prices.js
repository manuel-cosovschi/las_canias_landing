const { json, callN8n } = require("./_utils");

exports.handler = async () => {
  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const ownerSecret = process.env.LC_OWNER_SECRET;
    const path = process.env.N8N_OWNER_GET_PRICES_PATH; // reutilizamos el mismo path

    if (!baseUrl || !ownerSecret || !path) {
      return json(500, {
        message: "Faltan env vars: N8N_BASE_URL / LC_OWNER_SECRET / N8N_OWNER_GET_PRICES_PATH",
      });
    }

    // Llama a n8n con el secret, pero esto ocurre SERVER-SIDE (cliente nunca lo ve)
    const out = await callN8n(path, {
      method: "GET",
      baseUrl,
      secret: ownerSecret,
    });

    // Normalizá la respuesta a un formato simple
    // Esperamos algo tipo { LC1: 110000, LC2: 110000, ... } o { prices: {...} }
    const prices =
      out?.prices ||
      out?.data?.prices ||
      out?.data ||
      out;

    // Cache suave para no pegarle a n8n a cada refresh
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({ ok: true, prices }),
    };
  } catch (e) {
    // n8n contesta 4xx cuando rechaza por validación ("se solapan los
    // períodos", "esa reserva ya está cancelada"). callN8n guarda ese código
    // en e.status justamente para esto: devolver 500 convierte un "escribiste
    // algo que no va" en un "se rompió el servidor".
    return json(e.status || 500, e.payload || { ok: false, message: e.message || "Error" });
  }
};