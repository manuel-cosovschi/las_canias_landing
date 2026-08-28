// TEMPORAL — sonda para averiguar por qué Netlify Blobs no arranca.
//
// store-catalog contesta MissingBlobsEnvironmentError en producción: el
// runtime no le está inyectando NETLIFY_BLOBS_CONTEXT a las funciones. Todas
// las funciones del repo son formato v1 (exports.handler) y hay que saber si
// el contexto llega sólo en formato v2 antes de elegir el arreglo.
//
// Esta va en v2 (export default) a propósito, para comparar. No devuelve
// ningún dato: sólo si el contexto está y cómo se llama el error. Se borra
// apenas conteste.
export default async () => {
  const responder = (datos) =>
    new Response(JSON.stringify(datos), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  const tieneContexto = Boolean(process.env.NETLIFY_BLOBS_CONTEXT);

  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("tienda");
    await store.get("catalogo", { type: "json" });
    return responder({ formato: "v2", tieneContexto, blobs: "ok" });
  } catch (e) {
    return responder({ formato: "v2", tieneContexto, blobs: "error", motivo: e?.name || "Error" });
  }
};
