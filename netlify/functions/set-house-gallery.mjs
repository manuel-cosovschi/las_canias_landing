// /netlify/functions/set-house-gallery.mjs
// Acción de dueño: guarda las fotos y videos de una casa, en orden.
//
// Se manda la lista entera de esa casa, como en la tienda: el orden que ven
// en el panel es el que sale en la página. Con `items: null` la casa vuelve
// a sus fotos originales.
//
// Lo que la casa deja de usar se borra del almacenamiento al guardar.
//
// Formato v2 por Blobs, ver _v2.mjs.
import { guardarCasa, casaValida, MAXIMO_ITEMS, esDueno, respuestaJson } from "./_galeria.mjs";

export default async (req) => {
  if (!esDueno(req)) return respuestaJson(401, { ok: false, message: "No autorizado" });
  if (req.method !== "POST") return respuestaJson(405, { ok: false, message: "Method not allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return respuestaJson(400, { ok: false, message: "Body inválido" });
  }

  const casa = casaValida(body && body.casa);
  if (!casa) return respuestaJson(400, { ok: false, message: "Falta la casa (1 a 5)" });

  const items = body.items;
  if (items !== null && !Array.isArray(items)) {
    return respuestaJson(400, { ok: false, message: "Falta la lista de fotos" });
  }
  if (Array.isArray(items) && items.length > MAXIMO_ITEMS) {
    return respuestaJson(400, { ok: false, message: `Demasiadas fotos (máximo ${MAXIMO_ITEMS} por casa)` });
  }
  // Una casa sin ninguna foto deja la tarjeta con el cartel de "pronto". Si
  // eso es lo que quieren, que sea a propósito: para volver a las de siempre
  // está el otro botón.
  if (Array.isArray(items) && !items.length) {
    return respuestaJson(400, { ok: false, message: "La casa tiene que quedar con al menos una foto" });
  }

  try {
    const r = await guardarCasa(casa, items);
    // Se avisa cuántos entraron: si se mandaron 10 y volvieron 9, alguno se
    // descartó (una subida que no terminó, un camino raro) y hay que decirlo.
    return respuestaJson(200, {
      ok: true,
      casa,
      originales: r.lista === null,
      guardados: r.lista ? r.lista.length : 0,
      recibidos: r.recibidos,
      archivosBorrados: r.borrados,
    });
  } catch (e) {
    console.error("set-house-gallery:", e?.message || e);
    return respuestaJson(500, { ok: false, message: e?.message || "Error guardando la galería" });
  }
};
