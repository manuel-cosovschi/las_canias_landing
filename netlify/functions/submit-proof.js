// /netlify/functions/submit-proof.js
const Busboy = require("busboy");
const { json, callN8n } = require("./_utils");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.N8N_SECRET;
  if (!baseUrl || !secret) return json(500, { message: "Faltan env vars en Netlify" });

  // ⚠️ Webhook n8n NUEVO (para proof)
  const PROOF_WEBHOOK_PATH = process.env.N8N_PROOF_WEBHOOK_PATH;
  if (!PROOF_WEBHOOK_PATH) {
    return json(500, { message: "Falta N8N_PROOF_WEBHOOK_PATH (ej: /webhook/xxxxx)" });
  }

  try {
    const contentType = event.headers["content-type"] || event.headers["Content-Type"];
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return json(400, { message: "Content-Type debe ser multipart/form-data" });
    }

    const fields = {};
    let fileBuf = null;
    let fileName = "";
    let fileType = "";

    const bb = Busboy({ headers: { "content-type": contentType } });

    const done = new Promise((resolve, reject) => {
      bb.on("file", (name, file, info) => {
        fileName = info.filename || "comprobante";
        fileType = info.mimeType || "application/octet-stream";
        const chunks = [];
        file.on("data", (d) => chunks.push(d));
        file.on("end", () => { fileBuf = Buffer.concat(chunks); });
      });

      bb.on("field", (name, val) => {
        fields[name] = val;
      });

      bb.on("finish", resolve);
      bb.on("error", reject);
    });

    bb.end(Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8"));
    await done;

    if (!fields.id) return json(400, { message: "Falta id" });
    if (!fileBuf || !fileBuf.length) return json(400, { message: "Falta archivo comprobante" });

    // Mandamos a n8n en base64
    const payload = {
      ...fields,
      proof: {
        filename: fileName,
        mimeType: fileType,
        base64: fileBuf.toString("base64"),
      },
    };

    const out = await callN8n(PROOF_WEBHOOK_PATH, {
      method: "POST",
      body: payload,
      baseUrl,
      secret,
    });

    return json(200, out && out.ok === false ? out : { ok: true });
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};