// /netlify/functions/store-photo.mjs
// Devuelve la foto de un producto.
//
// A diferencia del comprobante de una reserva, esto es público: es la foto de
// algo que está a la venta. Pero sólo mientras la tienda esté publicada — si
// no, las fotos serían la rendija por donde se ve el catálogo que el
// "Próximamente" tapa.
//
// Formato v2 — ver el encabezado de _tienda.mjs. De paso, la foto sale como
// bytes en la Response: en v1 había que pasarla a base64 y avisar con una
// bandera.
import { leerCatalogo, leerFoto, idValido, esDueno, respuestaJson } from "./_tienda.mjs";

export default async (req) => {
  if (req.method !== "GET") return respuestaJson(405, { ok: false, message: "Method not allowed" });

  const id = idValido(new URL(req.url).searchParams.get("id"));
  if (!id) return respuestaJson(400, { ok: false, message: "Falta el id" });

  try {
    if (!esDueno(req)) {
      const catalogo = await leerCatalogo();
      if (!catalogo.publicada) return respuestaJson(404, { ok: false, message: "No encontrada" });
      // Una foto que quedó de un producto borrado tampoco se sirve.
      if (!catalogo.productos.some((p) => p.id === id)) {
        return respuestaJson(404, { ok: false, message: "No encontrada" });
      }
    }

    const foto = await leerFoto(id);
    if (!foto) return respuestaJson(404, { ok: false, message: "No encontrada" });

    return new Response(foto.buffer, {
      status: 200,
      headers: {
        "Content-Type": foto.contentType,
        "Access-Control-Allow-Origin": "*",
        // Corto a propósito: si cambian la foto de un producto, no queremos
        // que el visitante siga viendo la vieja durante un día.
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    return respuestaJson(500, { ok: false, message: e?.message || "Error" });
  }
};
