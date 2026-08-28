// netlify/functions/_proofs.js
// Guarda y devuelve el comprobante de transferencia de cada reserva.
//
// Hasta ahora el comprobante sólo viajaba por mail: para decidir si confirmar,
// el dueño tenía que salir del panel y buscarlo en Gmail. Acá queda una copia
// asociada al id de la reserva, que el panel puede mostrar al lado del botón
// de confirmar.
//
// Todo el trato con el almacenamiento pasa por este archivo: si algún día hay
// que mover los archivos a otro lado, se cambia acá y ni submit-proof ni
// proof-file se enteran.
//
// Esto y sus dos funciones son formato v2, que es lo único que ve Netlify
// Blobs. En v1 —como estaban— getStore() tiraba MissingBlobsEnvironmentError
// y las copias no se guardaban nunca. Como acá el error se traga a propósito
// (perder la copia no puede cortarle la reserva a nadie), venía fallando en
// silencio: el panel mostraba "sin comprobante" para todos. El porqué del
// formato, con la medición, está en _v2.mjs.
import { getStore } from "@netlify/blobs";

const STORE = "proofs";

// El id va en la URL y en la key del blob: que no se cuele nada raro.
function claveDe(id) {
  const limpio = String(id || "").trim();
  if (!limpio || limpio.length > 128) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(limpio)) return null;
  return limpio;
}

function store() {
  return getStore(STORE);
}

// Best-effort a propósito: si esto falla, el huésped ya mandó el comprobante y
// el mail sigue saliendo. Perder la copia del panel no puede cortarle la
// reserva a nadie.
async function saveProof(id, { buffer, contentType, filename }) {
  const key = claveDe(id);
  if (!key) return { ok: false, message: "id inválido" };
  if (!buffer || !buffer.length) return { ok: false, message: "archivo vacío" };

  try {
    await store().set(key, buffer, {
      metadata: {
        contentType: String(contentType || "application/octet-stream"),
        filename: String(filename || "comprobante"),
        size: buffer.length,
        uploadedAt: new Date().toISOString(),
      },
    });
    return { ok: true };
  } catch (e) {
    console.error("saveProof:", e?.message || e);
    return { ok: false, message: e?.message || "Error guardando el comprobante" };
  }
}

async function readProof(id) {
  const key = claveDe(id);
  if (!key) return null;

  const res = await store().getWithMetadata(key, { type: "arrayBuffer" });
  if (!res) return null;

  const meta = res.metadata || {};
  return {
    buffer: Buffer.from(res.data),
    contentType: String(meta.contentType || "application/octet-stream"),
    filename: String(meta.filename || "comprobante"),
    uploadedAt: String(meta.uploadedAt || ""),
  };
}

// Para que la lista del panel sepa cuáles tienen comprobante sin bajarse los
// archivos.
//
// Devuelve también si el almacenamiento respondió. Sin ese dato, un store caído
// se ve igual que "todavía nadie mandó comprobante": el panel no mostraría
// ningún botón y el dueño no tendría manera de enterarse de que la función
// dejó de guardar.
async function whichHaveProof(ids) {
  let s;
  try {
    s = store();
  } catch (e) {
    console.error("whichHaveProof: almacenamiento no disponible:", e?.message || e);
    return { ids: [], storageOk: false };
  }

  const out = [];
  let storageOk = true;

  await Promise.all(
    (ids || []).map(async (id) => {
      const key = claveDe(id);
      if (!key) return;
      try {
        const meta = await s.getMetadata(key);
        if (meta) out.push(key);
      } catch (e) {
        // Una clave que falla no es "no hay archivo": es el store fallando
        console.error("whichHaveProof:", key, e?.message || e);
        storageOk = false;
      }
    })
  );

  return { ids: out, storageOk };
}

export { saveProof, readProof, whichHaveProof };
