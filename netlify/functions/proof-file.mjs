// netlify/functions/proof-file.mjs
// Devuelve el comprobante de una reserva. Sólo para el dueño: acá viajan datos
// de pago de un huésped, así que pide Basic + x-lc-secret igual que el resto
// del panel y nunca se cachea en intermediarios.
//
// Dos modos:
//   GET ?id=XXX            → los bytes del archivo
//   GET ?ids=A,B,C&meta=1  → cuáles de esos ids tienen comprobante
//
// Formato v2 — ver _v2.mjs. Estaba en v1, donde Blobs no responde, así que
// este endpoint venía contestando "no hay comprobante" para todo. De paso el
// archivo sale como bytes: en v1 había que pasarlo a base64.
import { esDueno, respuestaJson, respuestaPreflight } from "./_v2.mjs";
import { readProof, whichHaveProof } from "./_proofs.mjs";
// El Basic del panel sale de _auth.js y no de una copia: es una comprobación
// de acceso, y dos copias que se separan es el tipo de error que no se nota
// hasta que ya pasó. Va _auth.js y no _sheet.js porque ese carga googleapis,
// que desde una función v2 el bundler deja sin resolver: la primera versión
// de esto contestaba 502.
import auth from "./_auth.js";

const esAdmin = (req) =>
  auth.verifyAdminAuth({ authorization: req.headers.get("authorization") || "" });

const MAX_IDS = 500;

export default async (req) => {
  if (req.method === "OPTIONS") return respuestaPreflight("GET");
  if (req.method !== "GET") return respuestaJson(405, { ok: false, message: "Method not allowed" });

  if (!esAdmin(req)) return respuestaJson(401, { ok: false, message: "No autorizado" });
  if (!esDueno(req)) return respuestaJson(403, { ok: false, message: "Falta x-lc-secret" });

  const p = new URL(req.url).searchParams;

  try {
    if (p.get("meta")) {
      const ids = String(p.get("ids") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, MAX_IDS);

      if (!ids.length) return respuestaJson(200, { ok: true, with_proof: [], storage_ok: true });

      const { ids: conArchivo, storageOk } = await whichHaveProof(ids);
      return respuestaJson(200, { ok: true, with_proof: conArchivo, storage_ok: storageOk });
    }

    const id = String(p.get("id") || "").trim();
    if (!id) return respuestaJson(400, { ok: false, message: "Falta id" });

    const proof = await readProof(id);
    if (!proof) {
      return respuestaJson(404, { ok: false, message: "No hay comprobante guardado para esa reserva" });
    }

    return new Response(proof.buffer, {
      status: 200,
      headers: {
        "Content-Type": proof.contentType,
        "Content-Disposition": `inline; filename="${proof.filename.replace(/[^\w.\- ]/g, "_")}"`,
        "Cache-Control": "no-store",
        "X-Proof-Uploaded-At": proof.uploadedAt,
      },
    });
  } catch (e) {
    return respuestaJson(500, { ok: false, message: e?.message || "Error" });
  }
};
