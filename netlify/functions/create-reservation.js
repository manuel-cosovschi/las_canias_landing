// /netlify/functions/create-reservation
const { json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  // Endpoint PÚBLICA para crear reservas (flujo front)
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    if (!baseUrl || !secret) return json(500, { message: "Faltan env vars en Netlify" });

    const bodyIn = JSON.parse(event.body || "{}");

    // ✅ Normalizamos nombres (acepta ambas variantes)
    const body = {
      house_code: bodyIn.house_code,
      checkin: bodyIn.checkin || bodyIn.check_in,
      checkout: bodyIn.checkout || bodyIn.check_out,
      guests: bodyIn.guests,
      guest_name: bodyIn.guest_name,
      dni: bodyIn.dni,
      email: bodyIn.email,
      phone: bodyIn.phone,
      payment_method: bodyIn.payment_method, // puede venir "TRANSFER", "transfer", etc.
      payment_ref: bodyIn.payment_ref || "",
      notes: bodyIn.notes || "",
    };

    // ✅ Validación mínima (con nombres normalizados)
    const missing = [];
    if (!body.house_code) missing.push("house_code");
    if (!body.checkin) missing.push("checkin/check_in");
    if (!body.checkout) missing.push("checkout/check_out");
    if (!body.guests) missing.push("guests");
    if (!body.guest_name) missing.push("guest_name");
    if (!body.dni) missing.push("dni");
    if (!body.email) missing.push("email");
    if (!body.phone) missing.push("phone");
    if (!body.payment_method) missing.push("payment_method");

    if (missing.length) {
      return json(400, { message: `Faltan campos: ${missing.join(", ")}` });
    }

    // ✅ Llamada server-side a n8n (poné acá el PATH real del webhook de create-reservation)
    // EJ: "/webhook/<TU_UUID_CREATE_RESERVATION>"
    const out = await callN8n("/webhook/create-reservation", {
      method: "POST",
      body,
      baseUrl,
      secret,
    });

    return json(200, out);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};