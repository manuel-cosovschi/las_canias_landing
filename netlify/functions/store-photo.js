// /netlify/functions/store-photo.js
// Devuelve la foto de un producto.
//
// A diferencia del comprobante de una reserva, esto es público: es la foto de
// algo que está a la venta. Pero sólo mientras la tienda esté publicada — si
// no, las fotos serían la rendija por donde se ve el catálogo que el
// "Próximamente" tapa.
const { assertAuth, json } = require("./_utils");
const { leerCatalogo, leerFoto, idValido } = require("./_tienda");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { ok: false, message: "Method not allowed" });

  const id = idValido((event.queryStringParameters || {}).id);
  if (!id) return json(400, { ok: false, message: "Falta el id" });

  try {
    const esDueno = assertAuth(event);

    if (!esDueno) {
      const catalogo = await leerCatalogo();
      if (!catalogo.publicada) return json(404, { ok: false, message: "No encontrada" });
      // Una foto que quedó de un producto borrado tampoco se sirve.
      if (!catalogo.productos.some((p) => p.id === id)) {
        return json(404, { ok: false, message: "No encontrada" });
      }
    }

    const foto = await leerFoto(id);
    if (!foto) return json(404, { ok: false, message: "No encontrada" });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": foto.contentType,
        "Access-Control-Allow-Origin": "*",
        // Corto a propósito: si cambian la foto de un producto, no queremos
        // que el visitante siga viendo la vieja durante un día.
        "Cache-Control": "public, max-age=300",
      },
      body: foto.buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
