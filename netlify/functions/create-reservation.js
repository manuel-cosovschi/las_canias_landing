// /netlify/functions/create-reservation.js
const { json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    if (!baseUrl || !secret) return json(500, { message: "Faltan env vars en Netlify" });

    const bodyIn = JSON.parse(event.body || "{}");

    // ✅ Normalizamos nombres
    const body = {
      house_code: bodyIn.house_code,
      checkin: bodyIn.checkin || bodyIn.check_in,
      checkout: bodyIn.checkout || bodyIn.check_out,
      guests: bodyIn.guests,
      guest_name: bodyIn.guest_name,
      dni: bodyIn.dni,
      email: bodyIn.email,
      phone: bodyIn.phone,
      // Datos de todos los que se alojan, no sólo de quien reserva. No es
      // obligatorio para no romper una página vieja que quedó cacheada.
      guests_details: Array.isArray(bodyIn.guests_details) ? bodyIn.guests_details : [],
      payment_method: bodyIn.payment_method ? String(bodyIn.payment_method).toLowerCase() : bodyIn.payment_method,
      payment_ref: bodyIn.payment_ref || "",
      notes: bodyIn.notes || "",
    };

    // ✅ Validación mínima
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

    if (missing.length) return json(400, { message: `Faltan campos: ${missing.join(", ")}` });

    // ✅ Llamada a n8n (PROD webhook)
    const out = await callN8n("/webhook/f484ae09-f5f4-492a-b88b-918c16b5a363", {
      method: "POST",
      body,
      baseUrl,
      secret,
    });

    // Si n8n devuelve {ok:false,...} lo pasamos tal cual
    if (out && out.ok === false) return json(200, out);

    // Si ya viene {ok:true,row:{...}} lo devolvemos
    if (out && out.ok === true && out.row) return json(200, out);

    // Caso: n8n devolvió la fila suelta
    return json(200, { ok: true, row: out });
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};