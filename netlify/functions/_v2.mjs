// netlify/functions/_v2.mjs
// Lo compartido por las funciones en formato v2.
//
// Por qué hay funciones en dos formatos: Netlify le inyecta
// NETLIFY_BLOBS_CONTEXT sólo a las v2 (`export default`, entra un Request y
// sale una Response). En v1 (`exports.handler`), getStore() tira
// MissingBlobsEnvironmentError. Se midió en un deploy real, con la misma
// llamada a Blobs en los dos formatos, al mismo sitio y al mismo store:
//
//   v2 -> { tieneContexto: true,  blobs: "ok" }
//   v1 -> { motivo: "MissingBlobsEnvironmentError" }
//
// Así que todo lo que toca Blobs —la tienda y los comprobantes— es v2, y el
// resto del repo sigue en v1. _utils.js no puede dar esta plomería porque lo
// comparten las funciones v1, que reciben un `event` y no un `Request`.
//
// El archivo es .mjs para que Node también lo trate como ESM: si fuera .js,
// el package.json de la raíz lo haría CommonJS y no se podría probar acá.

// Mismo criterio que assertAuth de _utils.js, pero leyendo de un Request.
// Headers.get() no distingue mayúsculas, así que alcanza con un nombre.
export function esDueno(req) {
  const esperado = process.env.LC_OWNER_SECRET || "";
  return Boolean(esperado) && req.headers.get("x-lc-secret") === esperado;
}

// El Basic del panel no vive acá a propósito: sale de verifyAdminAuth, en
// _sheet.js, que carga googleapis al importarse. Metido acá se lo llevaría
// puesto el bundle de store-catalog, que es público, caliente y no toca
// Sheets. Lo importa proof-file, que es el único que lo necesita.
export function respuestaJson(status, datos, cache) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-lc-secret",
      "Cache-Control": cache || "no-store",
    },
  });
}

export function respuestaPreflight(metodos) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-lc-secret",
      "Access-Control-Allow-Methods": `${metodos}, OPTIONS`,
    },
  });
}
