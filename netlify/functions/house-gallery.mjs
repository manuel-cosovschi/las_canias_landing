// /netlify/functions/house-gallery.mjs
// Las fotos y videos de las casas que los dueños armaron desde el panel.
//
// Sólo vienen las casas que tocaron: las otras siguen con sus fotos
// originales, que la página y el panel ya conocen (public/fotos-casas.json).
// Así, si esto falla, la página no queda vacía: muestra las de siempre.
//
// Público: son las fotos que se ven en la página. Formato v2 por Blobs, ver
// _v2.mjs.
import {
  leerOrden,
  idsEnUso,
  metasCompletas,
  urlSubida,
  esVideoPorNombre,
  TIPOS_VIDEO,
  esDueno,
  respuestaJson,
} from "./_galeria.mjs";

export default async (req) => {
  if (req.method !== "GET") return respuestaJson(405, { ok: false, message: "Method not allowed" });

  try {
    const orden = await leerOrden();
    const metas = await metasCompletas(idsEnUso(orden));

    const casas = {};
    for (const [casa, lista] of Object.entries(orden.casas)) {
      casas[casa] = lista
        .map((item) => {
          if (item.origen === "original") {
            return { origen: "original", src: item.src, video: esVideoPorNombre(item.src) };
          }
          const meta = metas.get(item.id);
          // Uno que se borró por otro lado no se manda: sería un hueco.
          if (!meta) return null;
          return {
            origen: "subida",
            id: item.id,
            src: urlSubida(item.id),
            video: TIPOS_VIDEO.includes(meta.tipo),
          };
        })
        .filter(Boolean);
    }

    // Un minuto de cache: cuando los dueños cambian algo, se ve enseguida.
    return respuestaJson(200, { ok: true, casas }, esDueno(req) ? "no-store" : "public, max-age=60");
  } catch (e) {
    console.error("house-gallery:", e?.message || e);
    // El nombre de la clase ayuda a distinguir "Blobs mal configurado" de
    // "Blobs caído" sin abrir los logs; el mensaje completo queda allá.
    return respuestaJson(503, { ok: false, message: "No se pudo leer la galería", motivo: e?.name || "Error" });
  }
};
