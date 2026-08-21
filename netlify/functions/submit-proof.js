// /netlify/functions/submit-proof.js
const Busboy = require("busboy");
const { json } = require("./_utils");
const { saveProof } = require("./_proofs");
const { Blob } = require("buffer");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });

  const baseUrl = process.env.N8N_BASE_URL;
  const secret = process.env.N8N_SECRET;
  const PROOF_WEBHOOK_PATH = process.env.N8N_PROOF_WEBHOOK_PATH;

  if (!baseUrl || !secret) return json(500, { message: "Faltan env vars en Netlify" });
  if (!PROOF_WEBHOOK_PATH) return json(500, { message: "Falta N8N_PROOF_WEBHOOK_PATH (ej: /webhook/xxxxx)" });

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
      bb.on("file", (fieldname, file, info) => {
        // Solo tomamos el archivo cuyo field name sea "proof"
        if (fieldname !== "proof") {
          file.resume();
          return;
        }

        fileName = info?.filename || "comprobante";
        fileType = info?.mimeType || "application/octet-stream";

        const chunks = [];
        file.on("data", (d) => chunks.push(d));
        file.on("end", () => {
          fileBuf = Buffer.concat(chunks);
        });
      });

      bb.on("field", (name, val) => {
        fields[name] = val;
      });

      bb.on("finish", resolve);
      bb.on("error", reject);
    });

    bb.end(Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8"));
    await done;

    if (!fields.id) return json(400, { message: "Falta id" });
    if (!fileBuf || !fileBuf.length) return json(400, { message: "Falta archivo comprobante (field: proof)" });

    // ✅ Re-armamos multipart para n8n (así n8n lo recibe en item.binary.proof)
    const fd = new FormData();

    // campos (n8n los verá en $json.body / $json según config del webhook)
    Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));

    // archivo binario (property name EXACTA: "proof")
    const blob = new Blob([fileBuf], { type: fileType });
    fd.append("proof", blob, fileName);

    const url = `${String(baseUrl).replace(/\/$/, "")}${PROOF_WEBHOOK_PATH.startsWith("/") ? "" : "/"}${PROOF_WEBHOOK_PATH}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        // NO setear Content-Type: fetch lo arma con el boundary del multipart
        "x-lc-secret": secret,
        "accept": "application/json",
      },
      body: fd,
    });

    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      return json(500, { message: "Error llamando a n8n", status: res.status, data });
    }

    // Copia para el panel. Va después de n8n y sin await bloqueante sobre el
    // resultado: si falla, el comprobante ya llegó por mail y el huésped no
    // tiene por qué enterarse de un problema nuestro de almacenamiento.
    const guardado = await saveProof(fields.id, {
      buffer: fileBuf,
      contentType: fileType,
      filename: fileName,
    });
    if (!guardado.ok) {
      console.error("submit-proof: no se pudo guardar la copia del comprobante:", guardado.message);
    }

    // n8n ya responde {ok:false,...} o {ok:true,...}
    return json(200, data);
  } catch (e) {
    return json(500, { message: e.message || "Error" });
  }
};