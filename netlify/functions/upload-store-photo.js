// /netlify/functions/upload-store-photo.js
// Acción de dueño: sube la foto de un producto.
//
// Mismo camino que el comprobante de una reserva (submit-proof + _proofs),
// sólo que acá el archivo no va a n8n: queda en el almacenamiento y lo sirve
// store-photo.
const Busboy = require("busboy");
const { assertAuth, json } = require("./_utils");
const { guardarFoto, idValido } = require("./_tienda");

// Las fotos las mira todo el que entra a la tienda: una de 8 MB hace lenta la
// página en el celular, que es donde se mira. Se corta antes de guardarla.
const MAXIMO = 3 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

exports.handler = async (event) => {
  if (!assertAuth(event)) return json(401, { ok: false, message: "No autorizado" });
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const contentType = event.headers["content-type"] || event.headers["Content-Type"];
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return json(400, { ok: false, message: "Content-Type debe ser multipart/form-data" });
  }

  try {
    const fields = {};
    let buffer = null;
    let filename = "";
    let tipo = "";
    let sePaso = false;

    const bb = Busboy({ headers: { "content-type": contentType }, limits: { fileSize: MAXIMO } });

    const listo = new Promise((resolve, reject) => {
      bb.on("file", (fieldname, file, info) => {
        if (fieldname !== "foto") {
          file.resume();
          return;
        }
        filename = info?.filename || "foto";
        tipo = info?.mimeType || "application/octet-stream";

        const trozos = [];
        file.on("data", (d) => trozos.push(d));
        // Busboy corta el archivo en el límite en vez de fallar: sin esto se
        // guardaría una imagen truncada, que es peor que no guardar nada.
        file.on("limit", () => { sePaso = true; });
        file.on("end", () => { buffer = Buffer.concat(trozos); });
      });

      bb.on("field", (name, val) => { fields[name] = val; });
      bb.on("finish", resolve);
      bb.on("error", reject);
    });

    bb.end(Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8"));
    await listo;

    if (sePaso) {
      return json(413, { ok: false, message: "La foto pesa más de 3 MB. Achicala y probá de nuevo." });
    }
    if (!idValido(fields.id)) {
      return json(400, { ok: false, message: "Falta el id del producto o tiene caracteres raros" });
    }
    if (!buffer || !buffer.length) {
      return json(400, { ok: false, message: "Falta la foto (campo: foto)" });
    }
    if (!TIPOS.includes(tipo)) {
      return json(415, { ok: false, message: "La foto tiene que ser JPG, PNG o WEBP" });
    }

    const guardada = await guardarFoto(fields.id, { buffer, contentType: tipo, filename });
    if (!guardada.ok) return json(500, guardada);

    return json(200, { ok: true, id: fields.id, bytes: buffer.length });
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error subiendo la foto" });
  }
};
