// /netlify/functions/create-reservation.js
const { json, callN8n } = require("./_utils");

const MIN_NIGHTS = 7;

// helpers UTC (sin bug timezone)
const toUTCms = (ymd) => {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const nightsBetween = (startYmd, endYmd) => {
  return Math.round((toUTCms(endYmd) - toUTCms(startYmd)) / 86400000);
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  try {
    const baseUrl = process.env.N8N_BASE_URL;
    const secret = process.env.N8N_SECRET;
    if (!baseUrl || !secret) return json(500, { message: "Faltan env vars en Netlify" });

    const bodyIn = JSON.parse(event.body || "{}");

    // ✅ Normalizamos nombres (acepta ambas variantes)
    const checkin = bodyIn.checkin || bodyIn.check_in;
    const checkout = bodyIn.checkout || bodyIn.check_out;

    const body = {
      house_code: bodyIn.house_code,
      checkin,
      checkout,
      guests: bodyIn.guests,
      guest_name: bodyIn.guest_name,
      dni: bodyIn.dni,
      email: bodyIn.email,
      phone: bodyIn.phone,
      payment_method: bodyIn.payment_method, // puede venir TRANSFER/transfer/etc.
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

    if (missing.length) return json(400, { ok: false, message: `Faltan campos: ${missing.join(", ")}` });

    // ✅ Validación server-side mínima 7 noches (Netlify manda)
    const nights = nightsBetween(body.checkin, body.checkout);
    if (!(nights > 0)) {
      return json(400, { ok: false, message: "Fechas inválidas: check-out debe ser posterior al check-in." });
    }
    if (nights < MIN_NIGHTS) {
      return json(400, { ok: false, message: `La estadía mínima es de ${MIN_NIGHTS} noches.` });
    }

    // ✅ Normalizar payment_method para n8n (por si viene TRANSFER)
    const pm = String(body.payment_method).toLowerCase();
    body.payment_method = pm;

    // ✅ Llamada a n8n (UUID REAL)
    const out = await callN8n("/webhook/f484ae09-f5f4-492a-b88b-918c16b5a363", {
      method: "POST",
      body,
      baseUrl,
      secret,
    });

    // Normalizar respuesta:
    // - si n8n devuelve { ok: false, ... } la dejamos pasar
    if (out && out.ok === false) return json(200, out);

    // Si ya viene {ok:true,row:{...}} lo devolvemos
    if (out && out.ok === true && out.row) return json(200, out);

    // Caso actual (fila suelta)
    return json(200, { ok: true, row: out });
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};