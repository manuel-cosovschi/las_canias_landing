// netlify/functions/proof-file.js
// Devuelve el comprobante de una reserva. Sólo para el dueño: acá viajan datos
// de pago de un huésped, así que pide Basic + x-lc-secret igual que el resto
// del panel y nunca se cachea en intermediarios.
//
// Dos modos:
//   GET ?id=XXX            → los bytes del archivo
//   GET ?ids=A,B,C&meta=1  → cuáles de esos ids tienen comprobante
const { assertAuth, json } = require("./_utils");
const { verifyAdminAuth } = require("./_sheet");
const { readProof, whichHaveProof } = require("./_proofs");

const MAX_IDS = 500;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-lc-secret",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") return json(405, { ok: false, message: "Method not allowed" });

  if (!verifyAdminAuth(event.headers)) return json(401, { ok: false, message: "No autorizado" });
  if (!assertAuth(event)) return json(403, { ok: false, message: "Falta x-lc-secret" });

  const p = event.queryStringParameters || {};

  try {
    if (p.meta) {
      const ids = String(p.ids || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, MAX_IDS);

      if (!ids.length) return json(200, { ok: true, with_proof: [], storage_ok: true });

      const { ids: conArchivo, storageOk } = await whichHaveProof(ids);
      return json(200, { ok: true, with_proof: conArchivo, storage_ok: storageOk });
    }

    const id = String(p.id || "").trim();
    if (!id) return json(400, { ok: false, message: "Falta id" });

    const proof = await readProof(id);
    if (!proof) return json(404, { ok: false, message: "No hay comprobante guardado para esa reserva" });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": proof.contentType,
        "Content-Disposition": `inline; filename="${proof.filename.replace(/[^\w.\- ]/g, "_")}"`,
        "Cache-Control": "no-store",
        "X-Proof-Uploaded-At": proof.uploadedAt,
      },
      body: proof.buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return json(500, { ok: false, message: e.message || "Error" });
  }
};
