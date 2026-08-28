// /netlify/functions/upload-store-photo.mjs
// Acción de dueño: sube la foto de un producto.
//
// Formato v2 — ver el encabezado de _tienda.mjs. Acá el cambio se nota: en v1
// había que desarmar el multipart a mano con Busboy, que corta el archivo al
// llegar al límite en vez de fallar y obliga a escuchar el evento "limit"
// para no guardar una imagen truncada. En v2 el Request ya sabe leer un
// formulario, y el tamaño se mira antes de tocar los bytes.
import { guardarFoto, idValido, esDueno, respuestaJson } from "./_tienda.mjs";

// Las fotos las mira todo el que entra a la tienda: una de 8 MB hace lenta la
// página en el celular, que es donde se mira. Se corta antes de guardarla.
const MAXIMO = 3 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

export default async (req) => {
  if (!esDueno(req)) return respuestaJson(401, { ok: false, message: "No autorizado" });
  if (req.method !== "POST") return respuestaJson(405, { ok: false, message: "Method not allowed" });

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return respuestaJson(400, { ok: false, message: "Content-Type debe ser multipart/form-data" });
  }

  try {
    let formulario;
    try {
      formulario = await req.formData();
    } catch {
      return respuestaJson(400, { ok: false, message: "No se pudo leer el formulario" });
    }

    const id = idValido(formulario.get("id"));
    if (!id) {
      return respuestaJson(400, { ok: false, message: "Falta el id del producto o tiene caracteres raros" });
    }

    const archivo = formulario.get("foto");
    // Un campo de texto llamado "foto" llega como string, no como archivo.
    if (!archivo || typeof archivo === "string" || !archivo.size) {
      return respuestaJson(400, { ok: false, message: "Falta la foto (campo: foto)" });
    }

    // El tamaño se mira antes de leer los bytes: no tiene sentido armar en
    // memoria una imagen que igual se va a rechazar.
    if (archivo.size > MAXIMO) {
      return respuestaJson(413, { ok: false, message: "La foto pesa más de 3 MB. Achicala y probá de nuevo." });
    }

    const tipo = archivo.type || "application/octet-stream";
    if (!TIPOS.includes(tipo)) {
      return respuestaJson(415, { ok: false, message: "La foto tiene que ser JPG, PNG o WEBP" });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const guardada = await guardarFoto(id, {
      buffer,
      contentType: tipo,
      filename: archivo.name || "foto",
    });
    if (!guardada.ok) return respuestaJson(500, guardada);

    return respuestaJson(200, { ok: true, id, bytes: buffer.length });
  } catch (e) {
    return respuestaJson(500, { ok: false, message: e?.message || "Error subiendo la foto" });
  }
};
