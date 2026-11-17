// /netlify/functions/upload-house-media.mjs
// Acción de dueño: sube una parte de una foto o video de una casa.
//
// El archivo viene de a pedazos de hasta 4 MB (ver _galeria.mjs), uno por
// pedido, en orden. Los datos de qué es van en la URL y los bytes crudos en
// el cuerpo: así no hay que desarmar un formulario para un pedazo de video.
//
//   POST ?id=<id>&n=<parte>&total=<partes>&tipo=<mime>&tamano=<bytes del archivo entero>
//
// Subir no lo muestra en la página: para eso hay que guardar la lista de la
// casa (set-house-gallery). Lo que se sube y no se guarda se borra solo.
//
// Formato v2 por Blobs, ver _v2.mjs.
import {
  guardarParte,
  idValido,
  problemaDeSubida,
  cuantasPartes,
  TAMANO_PARTE,
  esDueno,
  respuestaJson,
} from "./_galeria.mjs";

export default async (req) => {
  if (!esDueno(req)) return respuestaJson(401, { ok: false, message: "No autorizado" });
  if (req.method !== "POST") return respuestaJson(405, { ok: false, message: "Method not allowed" });

  const q = new URL(req.url).searchParams;
  const id = idValido(q.get("id"));
  const n = Number(q.get("n"));
  const total = Number(q.get("total"));
  const tipo = String(q.get("tipo") || "");
  const tamano = Number(q.get("tamano"));

  if (!id) return respuestaJson(400, { ok: false, message: "Falta el id o tiene caracteres raros" });

  const problema = problemaDeSubida({ tipo, tamano });
  if (problema) return respuestaJson(415, { ok: false, message: problema });

  // Las partes las decide el servidor y no el panel: si no coinciden, el
  // archivo armado no tendría el tamaño que dice.
  if (total !== cuantasPartes(tamano)) {
    return respuestaJson(400, { ok: false, message: "Cantidad de partes incorrecta" });
  }
  if (!Number.isInteger(n) || n < 0 || n >= total) {
    return respuestaJson(400, { ok: false, message: "Número de parte incorrecto" });
  }

  try {
    const bytes = new Uint8Array(await req.arrayBuffer());
    // Todas las partes miden TAMANO_PARTE menos la última, que es el resto.
    const esperado = n < total - 1 ? TAMANO_PARTE : tamano - TAMANO_PARTE * (total - 1);
    if (bytes.length !== esperado) {
      return respuestaJson(400, {
        ok: false,
        message: `La parte llegó incompleta (${bytes.length} de ${esperado} bytes), volvé a subirlo`,
      });
    }

    const r = await guardarParte({ id, n, total, tipo, tamano, bytes });
    if (!r.ok) return respuestaJson(r.status || 500, { ok: false, message: r.message });

    return respuestaJson(200, { ok: true, id, parte: n, completo: r.completo });
  } catch (e) {
    console.error("upload-house-media:", e?.message || e);
    return respuestaJson(500, { ok: false, message: e?.message || "Error subiendo el archivo" });
  }
};
