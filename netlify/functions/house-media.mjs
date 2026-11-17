// /netlify/functions/house-media.mjs
// Devuelve una foto o video que los dueños subieron para una casa.
//
// Público: son las fotos de la página. Los ids son al azar y no se listan en
// ningún lado salvo en la galería, que ya es pública.
//
// Contesta con Range (206). Los navegadores piden así los videos —Safari no
// reproduce uno que no lo soporte— y además es lo que permite servir un video
// de 100 MB: cada respuesta lleva como mucho una de las partes de 4 MB en
// que se guardó, y el navegador va pidiendo las siguientes.
//
// Formato v2 por Blobs, ver _v2.mjs.
import { idValido, leerMeta, leerParte, rangoPedido, TAMANO_PARTE, respuestaJson } from "./_galeria.mjs";

// Un id nunca cambia de contenido (ver _galeria.mjs), así que se puede
// guardar para siempre.
const CACHE = "public, max-age=31536000, immutable";

export default async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return respuestaJson(405, { ok: false, message: "Method not allowed" });
  }

  const id = idValido(new URL(req.url).searchParams.get("id"));
  if (!id) return respuestaJson(400, { ok: false, message: "Falta el id" });

  try {
    const meta = await leerMeta(id);
    if (!meta || !meta.completo) return respuestaJson(404, { ok: false, message: "No encontrado" });

    const tamano = meta.tamano;
    const base = {
      "Content-Type": meta.tipo,
      "Accept-Ranges": "bytes",
      "Cache-Control": CACHE,
      // Que la CDN no le dé a un pedido de "bytes=0-" la respuesta que guardó
      // para "bytes=8388608-": guarda una por cada Range distinto.
      "Netlify-Vary": "header=Range",
      Vary: "Range",
    };

    const rango = rangoPedido(req.headers.get("range"), tamano);

    if (rango && rango.invalido) {
      return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${tamano}` } });
    }

    if (rango) {
      const { desde, hasta, parte } = rango;
      const datos = req.method === "HEAD" ? null : await leerParte(id, parte);
      if (req.method !== "HEAD" && !datos) return respuestaJson(404, { ok: false, message: "No encontrado" });

      const inicioParte = parte * TAMANO_PARTE;
      const cuerpo = datos ? datos.subarray(desde - inicioParte, hasta - inicioParte + 1) : null;
      return new Response(cuerpo, {
        status: 206,
        headers: {
          ...base,
          "Content-Range": `bytes ${desde}-${hasta}/${tamano}`,
          "Content-Length": String(hasta - desde + 1),
        },
      });
    }

    // Sin Range: una foto (una sola parte) va entera. Un video en varias
    // partes se manda en streaming, de a una, para no armarlo entero en
    // memoria; ningún navegador lo pide así, pero un link abierto a mano sí.
    if (req.method === "HEAD") {
      return new Response(null, { status: 200, headers: { ...base, "Content-Length": String(tamano) } });
    }

    if (meta.partes === 1) {
      const datos = await leerParte(id, 0);
      if (!datos) return respuestaJson(404, { ok: false, message: "No encontrado" });
      return new Response(datos, { status: 200, headers: { ...base, "Content-Length": String(datos.length) } });
    }

    let n = 0;
    const flujo = new ReadableStream({
      async pull(controller) {
        if (n >= meta.partes) return controller.close();
        const datos = await leerParte(id, n++);
        if (!datos) return controller.error(new Error(`Falta la parte ${n - 1}`));
        controller.enqueue(datos);
      },
    });
    return new Response(flujo, { status: 200, headers: { ...base, "Content-Length": String(tamano) } });
  } catch (e) {
    console.error("house-media:", e?.message || e);
    return respuestaJson(500, { ok: false, message: "Error" });
  }
};
