// /netlify/functions/create-reservation.js
const { json, callN8n } = require("./_utils");
// El importe se recalcula acá y no se toma del navegador: ver más abajo.
const { leerPeriodos, totalEstadia } = require("./_tarifas");

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
      // El importe se recalcula más abajo con las tarifas del servidor. Lo que
      // mande la página queda como respaldo y nada más.
      importe: Number.isFinite(Number(bodyIn.importe)) && Number(bodyIn.importe) > 0
        ? Math.round(Number(bodyIn.importe))
        : "",
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

    // El importe lo manda el navegador, y de acá va derecho a la planilla, al
    // documento de reserva y a Números. O sea: es un número que el huésped
    // elige y que después el dueño lee como si fuera el precio. Se recalcula
    // con las tarifas del servidor, que son las mismas que miró la página.
    //
    // Si las tarifas no se pueden leer se deja lo que vino, que es como venía
    // funcionando: cortar una reserva real por no poder verificar un importe
    // que el dueño igual revisa antes de confirmar sería peor que el problema.
    try {
      const periodos = await leerPeriodos();
      if (periodos.length) {
        const calculado = totalEstadia(periodos, body.checkin, body.checkout, body.house_code);
        if (calculado != null) {
          if (body.importe !== "" && body.importe !== calculado) {
            console.warn(
              `create-reservation: el importe del navegador (${body.importe}) no coincide ` +
              `con el calculado (${calculado}) para ${body.house_code} ${body.checkin}->${body.checkout}`
            );
          }
          body.importe = calculado;
        }
      }
    } catch (e) {
      console.error("create-reservation: no se pudieron leer las tarifas:", e.message);
    }

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
    // n8n contesta 4xx cuando rechaza por validación ("se solapan los
    // períodos", "esa reserva ya está cancelada"). callN8n guarda ese código
    // en e.status justamente para esto: devolver 500 convierte un "escribiste
    // algo que no va" en un "se rompió el servidor".
    return json(e.status || 500, e.payload || { message: e.message || "Error" });
  }
};