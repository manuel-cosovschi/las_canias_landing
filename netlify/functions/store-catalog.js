// /netlify/functions/store-catalog.js
// Devuelve el catálogo de la tienda.
//
// Con secret (el panel, o el dueño espiando desde la landing) vuelve entero,
// publicado o no. Sin secret, si la tienda no está publicada, no vuelve ni un
// nombre: el visitante recibe { publicada: false } y nada más.
//
// Eso es lo que hace que el "Próximamente" valga algo. Mientras el catálogo
// vivía en el javascript de la página, esconderlo era pintura: los nombres y
// precios viajaban igual y cualquiera los leía con el inspector.
const { assertAuth, json } = require("./_utils");
const { leerCatalogo, cualesTienenFoto } = require("./_tienda");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { ok: false, message: "Method not allowed" });

  const esDueno = assertAuth(event);

  try {
    const catalogo = await leerCatalogo();

    if (catalogo.error) {
      return json(503, { ok: false, message: "No se pudo leer el catálogo", motivo: catalogo.motivo });
    }

    if (!catalogo.publicada && !esDueno) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          // Sin cache: el día que la publiquen, tiene que verse ya.
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ ok: true, publicada: false, productos: [] }),
      };
    }

    // Se le pregunta al almacenamiento cuáles tienen foto de verdad, para que
    // la página no arme el <img> de una que no existe.
    const conFoto = await cualesTienenFoto(catalogo.productos.map((p) => p.id));
    const productos = catalogo.productos.map((p) => ({ ...p, tieneFoto: conFoto.has(p.id) }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": esDueno ? "no-store" : "public, max-age=60",
      },
      body: JSON.stringify({ ok: true, publicada: catalogo.publicada, productos }),
    };
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
