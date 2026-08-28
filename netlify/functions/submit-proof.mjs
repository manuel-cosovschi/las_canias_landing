// /netlify/functions/submit-proof.mjs
// El huésped manda el comprobante de la transferencia.
//
// Hace dos cosas, en este orden: se lo pasa a n8n (que manda el mail y mueve
// la reserva a PROOF_SENT) y después guarda una copia para el panel. El orden
// importa: lo que no puede fallar es el aviso al dueño.
//
// Formato v2 — ver _v2.mjs. Estaba en v1 y por eso la copia del panel nunca
// se guardó: getStore() tiraba MissingBlobsEnvironmentError y el error se
// traga a propósito, así que falló en silencio desde el primer día.
//
// De paso se va Busboy: en v2 el Request ya sabe leer un formulario. Antes
// había que desarmar el multipart a mano y volver a armarlo para n8n.
import { respuestaJson } from "./_v2.mjs";
import { saveProof } from "./_proofs.mjs";

export default async (req) => {
  if (req.method !== "POST") return respuestaJson(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.N8N_SECRET;
  const PROOF_WEBHOOK_PATH = process.env.N8N_PROOF_WEBHOOK_PATH;

  if (!baseUrl || !secret) return respuestaJson(500, { message: "Faltan env vars en Netlify" });
  if (!PROOF_WEBHOOK_PATH) {
    return respuestaJson(500, { message: "Falta N8N_PROOF_WEBHOOK_PATH (ej: /webhook/xxxxx)" });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return respuestaJson(400, { message: "Content-Type debe ser multipart/form-data" });
  }

  try {
    let entrada;
    try {
      entrada = await req.formData();
    } catch {
      return respuestaJson(400, { message: "No se pudo leer el formulario" });
    }

    // Se separan los campos de texto del archivo. Sólo cuenta el archivo que
    // viene bajo "proof": el resto se ignora, como hacía la versión anterior.
    const campos = {};
    let archivo = null;
    for (const [nombre, valor] of entrada.entries()) {
      if (nombre === "proof" && typeof valor !== "string") archivo = valor;
      else if (typeof valor === "string") campos[nombre] = valor;
    }

    if (!campos.id) return respuestaJson(400, { message: "Falta id" });
    if (!archivo || !archivo.size) {
      return respuestaJson(400, { message: "Falta archivo comprobante (field: proof)" });
    }

    const nombreArchivo = archivo.name || "comprobante";
    const tipoArchivo = archivo.type || "application/octet-stream";
    const bytes = Buffer.from(await archivo.arrayBuffer());

    // Se rearma el multipart para n8n, que espera el binario en la propiedad
    // "proof" — el nombre tiene que ser ese exacto.
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.append(k, String(v));
    fd.append("proof", new Blob([bytes], { type: tipoArchivo }), nombreArchivo);

    const url =
      `${String(baseUrl).replace(/\/$/, "")}` +
      `${PROOF_WEBHOOK_PATH.startsWith("/") ? "" : "/"}${PROOF_WEBHOOK_PATH}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        // Sin Content-Type: fetch lo arma con el boundary del multipart.
        "x-lc-secret": secret,
        accept: "application/json",
      },
      body: fd,
    });

    const texto = await res.text();
    let data = {};
    try { data = JSON.parse(texto); } catch { data = { raw: texto }; }

    if (!res.ok) {
      return respuestaJson(500, { message: "Error llamando a n8n", status: res.status, data });
    }

    // La copia para el panel va después de n8n: si falla, el comprobante ya
    // llegó por mail y el huésped no tiene por qué enterarse de un problema
    // nuestro de almacenamiento.
    const guardado = await saveProof(campos.id, {
      buffer: bytes,
      contentType: tipoArchivo,
      filename: nombreArchivo,
    });
    if (!guardado.ok) {
      console.error("submit-proof: no se pudo guardar la copia del comprobante:", guardado.message);
    }

    // n8n ya responde {ok:false,...} o {ok:true,...}
    return respuestaJson(200, data);
  } catch (e) {
    return respuestaJson(500, { message: e?.message || "Error" });
  }
};
