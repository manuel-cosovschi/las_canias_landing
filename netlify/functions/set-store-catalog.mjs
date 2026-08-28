// /netlify/functions/set-store-catalog.mjs
// Acción de dueño: reemplaza el catálogo completo y el estado de publicación.
//
// Se manda la lista entera, como en los precios y las reglas: así el orden que
// ve el dueño en el panel es el que sale publicado, y no hay que inventar un
// campo de orden que después nadie mantiene.
//
// Formato v2 — ver el encabezado de _tienda.mjs.
import {
  leerCatalogo,
  guardarCatalogo,
  borrarFoto,
  cualesTienenFoto,
  esDueno,
  respuestaJson,
} from "./_tienda.mjs";

export default async (req) => {
  if (!esDueno(req)) return respuestaJson(401, { ok: false, message: "No autorizado" });
  if (req.method !== "POST") return respuestaJson(405, { ok: false, message: "Method not allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return respuestaJson(400, { ok: false, message: "Body inválido" });
  }

  try {
    if (!Array.isArray(body?.productos)) {
      return respuestaJson(400, { ok: false, message: "Falta la lista de productos" });
    }
    if (body.productos.length > 200) {
      return respuestaJson(400, { ok: false, message: "Demasiados productos (máximo 200)" });
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
    return respuestaJson(200, {
      ok: true,
      publicada: guardado.publicada,
      guardados: guardado.productos.length,
      recibidos: body.productos.length,
      productosSacados: sacados.length,
      fotosBorradas: conFoto.size,
    });
  } catch (e) {
    return respuestaJson(500, { ok: false, message: e?.message || "Error" });
  }
};
