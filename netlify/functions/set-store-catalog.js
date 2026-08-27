// /netlify/functions/set-store-catalog.js
// Acción de dueño: reemplaza el catálogo completo y el estado de publicación.
//
// Se manda la lista entera, como en los precios y las reglas: así el orden que
// ve el dueño en el panel es el que sale publicado, y no hay que inventar un
// campo de orden que después nadie mantiene.
const { assertAuth, json } = require("./_utils");
const { leerCatalogo, guardarCatalogo, borrarFoto, cualesTienenFoto } = require("./_tienda");

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  try {
    const body = JSON.parse(event.body || "{}");

    if (!Array.isArray(body.productos)) {
      return json(400, { ok: false, message: "Falta la lista de productos" });
    }
    if (body.productos.length > 200) {
      return json(400, { ok: false, message: "Demasiados productos (máximo 200)" });
    }

    // Lo que quedó afuera de la lista nueva ya no existe: sus fotos tampoco,
    // o el almacenamiento se llena de archivos que nadie va a mirar.
    const antes = await leerCatalogo();
    const guardado = await guardarCatalogo(body);
    const quedan = new Set(guardado.productos.map((p) => p.id));
    const sacados = antes.productos.filter((p) => !quedan.has(p.id)).map((p) => p.id);

    // Se pregunta cuáles tenían foto antes de borrar: la mayoría de los
    // productos que se sacan no tienen ninguna, y un "borré 3 fotos" cuando
    // había una sola es un número que miente.
    const conFoto = sacados.length ? await cualesTienenFoto(sacados) : new Set();
    await Promise.all([...conFoto].map((id) => borrarFoto(id)));

    // Se avisa cuántos entraron: si el dueño mandó 10 y volvieron 9, alguno
    // se descartó por id o nombre inválido y tiene que enterarse.
    return json(200, {
      ok: true,
      publicada: guardado.publicada,
      guardados: guardado.productos.length,
      recibidos: body.productos.length,
      productosSacados: sacados.length,
      fotosBorradas: conFoto.size,
    });
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
