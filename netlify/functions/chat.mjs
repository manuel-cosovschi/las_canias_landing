// Proxy seguro a OpenAI. La API key vive SOLO en la env var OPENAI_API_KEY
// del entorno de Netlify, nunca en el frontend ni en el repo.

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `Sos "Cañitas", el asistente virtual del complejo de alquiler turístico "Las Cañas" en Mar de Cobó (Mar de Cobo), Buenos Aires, Argentina. Hablás en español rioplatense, de forma cálida, breve y amable. Tratás de "vos".

Datos del complejo:
- Anfitriones: Ana y Gonzalo. Hace más de 10 años que reciben huéspedes.
- Son 5 casas, todas a una cuadra de la playa.
- Servicios comunes: WiFi (Starlink), Smart TV, cocina equipada, parrilla privada y parque. Incluye toallas de manos y toallones, calefacción, 2 ventiladores grandes de pie, mosquiteros y ducha exterior.

Casas:
- Las Cañas 1 (LC1): hasta 4 personas. 2 ambientes, 2 plantas, 2 baños (1 baño + 1 toilette), 3 camas (1 queen + 2 singles). Ideal 2 adultos + 2 niños. No se aceptan mascotas.
- Las Cañas 2 (LC2): hasta 4 personas. 2 ambientes, 2 baños, 4 camas.
- Las Cañas 3 (LC3): hasta 5 personas. 3 ambientes, 2 baños, 5 camas + carrito.
- Las Cañas 4 (LC4): hasta 4 personas. 2 ambientes, 1 baño, 4 camas.
- Las Cañas 5 (LC5): 2 adultos + 1 niño. 2 ambientes, 1 baño, 2 camas + futón.

Reservas:
- Se reservan desde la página de reservas del sitio (botón "Reservar"). La estadía mínima general es de 2 noches (4 en Semana Santa) y se abona una seña del 50% para confirmar.
- Para reservar mandá al usuario a la página de reservas del sitio.

Contacto:
- WhatsApp: +54 223 688 2986.

Reglas importantes:
- NO inventes precios ni disponibilidad exactos: cambian y se gestionan en la página de reservas. Si te preguntan precios o fechas puntuales, indicá que los vea en la página de reservas o que escriba por WhatsApp.
- Si no sabés algo con certeza, decilo y derivá al WhatsApp.
- Respondé corto (2 a 5 oraciones salvo que pidan detalle). No uses markdown complejo.
- Si preguntan algo que no tiene que ver con el complejo, redirigí amablemente al tema de Las Cañas.`;

const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  },
  body: JSON.stringify(payload),
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(500, { message: "Falta configurar OPENAI_API_KEY en el entorno." });

  try {
    const body = JSON.parse(event.body || "{}");
    const incoming = Array.isArray(body.messages) ? body.messages : [];

    // Sanitizar: solo user/assistant, recortar largo, limitar a las últimas 12.
    const history = incoming
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    if (history.length === 0) return json(400, { message: "No hay mensajes." });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 400,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || "Error consultando al asistente";
      return json(502, { message: msg });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim() || "Perdoná, no pude generar una respuesta. Probá de nuevo o escribinos por WhatsApp.";
    return json(200, { reply });
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};
