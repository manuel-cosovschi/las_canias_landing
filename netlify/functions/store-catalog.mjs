// /netlify/functions/store-catalog.mjs
// Devuelve el catálogo de la tienda.
//
// Con secret (el panel, o el dueño espiando desde la tienda) vuelve entero,
// publicado o no. Sin secret, si la tienda no está publicada, no vuelve ni un
// nombre: el visitante recibe { publicada: false } y nada más.
//
// Eso es lo que hace que el "Próximamente" valga algo. Mientras el catálogo
// vivía en el javascript de la página, esconderlo era pintura: los nombres y
// precios viajaban igual y cualquiera los leía con el inspector.
//
// Formato v2 (export default) porque Netlify le inyecta el contexto de Blobs
// sólo a las v2 — ver el encabezado de _tienda.mjs.
import { leerCatalogo, cualesTienenFoto, esDueno, respuestaJson } from "./_tienda.mjs";

export default async (req) => {
  if (req.method !== "GET") return respuestaJson(405, { ok: false, message: "Method not allowed" });

  const dueno = esDueno(req);

  try {
    const catalogo = await leerCatalogo();

    if (catalogo.error) {
      return respuestaJson(503, {
        ok: false,
        message: "No se pudo leer el catálogo",
        motivo: catalogo.motivo,
      });
    }

    if (!catalogo.publicada && !dueno) {
      // Sin cache: el día que la publiquen, tiene que verse ya.
      return respuestaJson(200, { ok: true, publicada: false, productos: [] });
    }

    // Se le pregunta al almacenamiento cuáles tienen foto de verdad, para que
    // la página no arme el <img> de una que no existe.
    const conFoto = await cualesTienenFoto(catalogo.productos.map((p) => p.id));
    const productos = catalogo.productos.map((p) => ({ ...p, tieneFoto: conFoto.has(p.id) }));

    return respuestaJson(
      200,
      { ok: true, publicada: catalogo.publicada, productos },
      dueno ? "no-store" : "public, max-age=60"
    );
  } catch (e) {
    return respuestaJson(500, { ok: false, message: e?.message || "Error" });
  }
};
