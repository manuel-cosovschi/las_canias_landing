// netlify/functions/_galeria.mjs
// Las fotos y videos de cada casa que los dueños arman desde el panel.
//
// Mismo almacenamiento que la tienda y los comprobantes: Netlify Blobs, y por
// eso todas las funciones de la galería son v2 (el porqué está en _v2.mjs).
//
// Qué se guarda:
//
//   orden            un JSON con la lista de cada casa que los dueños tocaron.
//                    Una casa que no está acá muestra sus fotos originales
//                    (las de public/fotos-casas.json, que vienen en el repo).
//   meta/<id>        de cada archivo subido: tipo, tamaño, en cuántas partes
//                    vino y si ya llegó entero.
//   parte/<id>/<n>   los bytes, de a pedazos.
//
// Por qué en pedazos: Netlify no acepta un pedido de más de 6 MB, y un video
// del celular pesa decenas. El panel lo corta en partes de 4 MB (que en base64
// quedan en 5,3 MB, debajo del límite) y las manda de a una. Para servirlo
// vale lo mismo al revés: house-media contesta de a un pedazo por vez, con
// Range, que es como el navegador pide los videos de todos modos. Las fotos
// el panel las achica antes de subirlas, así que entran en una sola parte.
//
// Cada archivo subido tiene un id nuevo y nunca se reescribe: si cambian una
// foto, es otro id. Eso deja cachearlos para siempre sin miedo a mostrar una
// versión vieja.
import { getStore } from "@netlify/blobs";

const STORE = "galeria-casas";
const CLAVE_ORDEN = "orden";

export const CASAS = [1, 2, 3, 4, 5];
export const TAMANO_PARTE = 4 * 1024 * 1024;
export const MAXIMO_VIDEO = 150 * 1024 * 1024;
// Ya achicada por el panel una foto pesa menos de 1 MB. El tope es para que
// una que llegó sin achicar no pase igual.
export const MAXIMO_FOTO = TAMANO_PARTE;
export const MAXIMO_ITEMS = 60;
// Lo que se subió y nunca se guardó en ninguna casa (el dueño subió y tocó
// "Descartar") se borra pasado este tiempo, en el siguiente guardado.
const HUERFANO_DESPUES_DE_MS = 24 * 60 * 60 * 1000;

export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
export const TIPOS_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];

// "strong" y no la consistencia por defecto: al terminar de subir un video se
// pregunta si llegaron todas las partes, y con la otra el almacenamiento puede
// contestar que no durante un minuto aunque estén.
function store() {
  return getStore({ name: STORE, consistency: "strong" });
}

// El id va en la URL y en la clave del blob: que no se cuele nada.
export function idValido(id) {
  const limpio = String(id || "").trim();
  if (!limpio || limpio.length > 64) return null;
  if (!/^[a-z0-9-]+$/.test(limpio)) return null;
  return limpio;
}

export function casaValida(casa) {
  const n = Number(casa);
  return CASAS.includes(n) ? n : null;
}

// Una foto original es un archivo del repo: se acepta el camino sólo si tiene
// la forma de las carpetas de las casas. Sin esto, un pedido armado a mano
// podría meter en la página cualquier URL.
const RE_ORIGINAL = /^\/Casa [1-5] Imagenes\/[^/?#\\]+\.(jpe?g|png|webp|mp4|mov|webm)$/i;

export function esVideoPorNombre(camino) {
  return /\.(mp4|mov|webm)$/i.test(String(camino || ""));
}

export const urlSubida = (id) => `/api/house-media?id=${id}`;

// Un ítem guardado nunca es lo que llegó del navegador: se arma campo por
// campo.
export function normalizarItem(item) {
  if (!item || typeof item !== "object") return null;

  if (item.origen === "original") {
    const src = String(item.src || "");
    if (!RE_ORIGINAL.test(src)) return null;
    return { origen: "original", src };
  }

  if (item.origen === "subida") {
    const id = idValido(item.id);
    if (!id) return null;
    return { origen: "subida", id };
  }

  return null;
}

export function normalizarLista(items) {
  if (!Array.isArray(items)) return null;
  const lista = [];
  const vistos = new Set();
  for (const crudo of items) {
    const item = normalizarItem(crudo);
    if (!item) continue;
    // La misma foto dos veces no la quiere nadie, y repetida en la lista
    // aparece dos veces en la galería.
    const clave = item.origen === "subida" ? `s:${item.id}` : `o:${item.src}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push(item);
    if (lista.length >= MAXIMO_ITEMS) break;
  }
  return lista;
}

function normalizarOrden(crudo) {
  const casas = {};
  for (const casa of CASAS) {
    const lista = normalizarLista(crudo && crudo.casas && crudo.casas[casa]);
    if (lista) casas[casa] = lista;
  }
  return { casas };
}

export async function leerOrden() {
  const crudo = await store().get(CLAVE_ORDEN, { type: "json" });
  return normalizarOrden(crudo);
}

async function guardarOrden(orden) {
  const limpio = normalizarOrden(orden);
  await store().set(CLAVE_ORDEN, JSON.stringify(limpio), {
    metadata: { guardadoEn: new Date().toISOString() },
  });
  return limpio;
}

export function idsEnUso(orden) {
  const ids = new Set();
  for (const lista of Object.values((orden && orden.casas) || {})) {
    for (const item of lista) if (item.origen === "subida") ids.add(item.id);
  }
  return ids;
}

// ---------- archivos subidos ----------

const claveMeta = (id) => `meta/${id}`;
const clavePart = (id, n) => `parte/${id}/${n}`;

export async function leerMeta(id) {
  const limpio = idValido(id);
  if (!limpio) return null;
  return store().get(claveMeta(limpio), { type: "json" });
}

// De cada id, si llegó entero y si es video. Los que no están o quedaron a
// medio subir no vuelven: no se muestra el hueco de un archivo que no existe.
export async function metasCompletas(ids) {
  const metas = new Map();
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        const meta = await leerMeta(id);
        if (meta && meta.completo) metas.set(id, meta);
      } catch (e) {
        console.error("metasCompletas:", id, e?.message || e);
      }
    })
  );
  return metas;
}

export function cuantasPartes(tamano) {
  return Math.max(1, Math.ceil(tamano / TAMANO_PARTE));
}

// Qué se acepta subir. Devuelve un mensaje para el dueño, o null si está bien.
export function problemaDeSubida({ tipo, tamano }) {
  const esFoto = TIPOS_FOTO.includes(tipo);
  const esVideo = TIPOS_VIDEO.includes(tipo);
  if (!esFoto && !esVideo) return "Sólo fotos (JPG, PNG, WEBP) o videos (MP4, MOV, WEBM).";
  if (!Number.isFinite(tamano) || tamano <= 0) return "El archivo está vacío.";
  if (esFoto && tamano > MAXIMO_FOTO) return "La foto pesa más de 4 MB.";
  if (esVideo && tamano > MAXIMO_VIDEO) {
    return "El video pesa más de 150 MB. Recortalo o mandátelo por WhatsApp (que lo comprime) y subí ese.";
  }
  return null;
}

// Guarda una parte. La primera crea la ficha del archivo; la última, si
// llegaron todas, lo marca completo y desde ahí se puede mostrar.
export async function guardarParte({ id, n, total, tipo, tamano, bytes }) {
  const s = store();

  if (n === 0) {
    const existente = await s.get(claveMeta(id), { type: "json" });
    // Un id ya completo no se pisa: lo puede estar mostrando la página, y
    // quedaría cacheado con el contenido viejo.
    if (existente && existente.completo) {
      return { ok: false, status: 409, message: "Ese archivo ya existe" };
    }
    await s.setJSON(claveMeta(id), {
      tipo,
      tamano,
      partes: total,
      completo: false,
      subidaEn: new Date().toISOString(),
    });
  } else {
    const meta = await s.get(claveMeta(id), { type: "json" });
    if (!meta) return { ok: false, status: 409, message: "Falta la primera parte" };
    if (meta.completo) return { ok: false, status: 409, message: "Ese archivo ya existe" };
    if (meta.tipo !== tipo || meta.tamano !== tamano || meta.partes !== total) {
      return { ok: false, status: 409, message: "Las partes no coinciden con el archivo" };
    }
  }

  await s.set(clavePart(id, n), bytes);

  if (n !== total - 1) return { ok: true, completo: false };

  // La última parte: se confirma que estén todas antes de darlo por bueno.
  const presentes = await Promise.all(
    Array.from({ length: total }, (_, i) => s.getMetadata(clavePart(id, i)))
  );
  if (presentes.some((p) => !p)) {
    return { ok: false, status: 409, message: "Faltan partes del archivo, volvé a subirlo" };
  }

  const meta = await s.get(claveMeta(id), { type: "json" });
  await s.setJSON(claveMeta(id), { ...meta, completo: true });
  return { ok: true, completo: true };
}

export async function leerParte(id, n) {
  const datos = await store().get(clavePart(id, n), { type: "arrayBuffer" });
  return datos ? new Uint8Array(datos) : null;
}

async function borrarArchivo(id) {
  const s = store();
  const meta = await s.get(claveMeta(id), { type: "json" }).catch(() => null);
  // Si la ficha no dice cuántas partes había, se buscan por prefijo.
  let claves;
  if (meta && Number.isInteger(meta.partes)) {
    claves = Array.from({ length: meta.partes }, (_, i) => clavePart(id, i));
  } else {
    const { blobs } = await s.list({ prefix: `parte/${id}/` });
    claves = blobs.map((b) => b.key);
  }
  await Promise.all(claves.map((k) => s.delete(k)));
  await s.delete(claveMeta(id));
}

// Guarda la lista de una casa (o la borra, con null, para volver a las
// originales) y limpia los archivos que ya no usa nadie.
export async function guardarCasa(casa, items) {
  const antes = await leerOrden();
  const despues = { casas: { ...antes.casas } };

  let lista = null;
  if (items === null) {
    delete despues.casas[casa];
  } else {
    lista = normalizarLista(items) || [];
    // Un archivo que no llegó entero no entra: en la página sería un hueco.
    const subidas = lista.filter((i) => i.origen === "subida").map((i) => i.id);
    const completas = await metasCompletas(subidas);
    lista = lista.filter((i) => i.origen !== "subida" || completas.has(i.id));
    despues.casas[casa] = lista;
  }

  const guardado = await guardarOrden(despues);
  const borrados = await limpiarArchivos(antes, guardado);
  return { lista: guardado.casas[casa] || null, recibidos: items ? items.length : 0, borrados };
}

// Lo que la casa dejó de usar se borra ya. Lo subido que nunca se guardó en
// ninguna casa, pasado un día: puede ser que el dueño esté a mitad de armar
// la lista en otra pestaña.
async function limpiarArchivos(antes, despues) {
  const enUso = idsEnUso(despues);
  const aBorrar = new Set([...idsEnUso(antes)].filter((id) => !enUso.has(id)));

  try {
    const { blobs } = await store().list({ prefix: "meta/" });
    const ahora = Date.now();
    await Promise.all(
      blobs.map(async ({ key }) => {
        const id = key.slice("meta/".length);
        if (enUso.has(id) || aBorrar.has(id)) return;
        const meta = await leerMeta(id).catch(() => null);
        const cuando = Date.parse(meta && meta.subidaEn);
        if (!Number.isFinite(cuando) || ahora - cuando > HUERFANO_DESPUES_DE_MS) aBorrar.add(id);
      })
    );
  } catch (e) {
    // Que no se pueda limpiar no puede impedir guardar: lo que sobra se
    // borra en el próximo guardado.
    console.error("limpiarArchivos (huérfanos):", e?.message || e);
  }

  let borrados = 0;
  for (const id of aBorrar) {
    try {
      await borrarArchivo(id);
      borrados++;
    } catch (e) {
      console.error("limpiarArchivos:", id, e?.message || e);
    }
  }
  return borrados;
}

// ---------- servir con Range ----------

// Lee el header Range y devuelve qué bytes mandar, o null si no hay Range o
// no se entiende (en ese caso se manda desde el principio). Sólo un rango:
// los navegadores no piden varios para un video.
//
// Nunca se manda más de una parte por respuesta: la respuesta de una función
// también tiene tope de tamaño. El navegador pide lo que sigue solo.
export function rangoPedido(header, tamano) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;

  let desde;
  let hasta;
  if (m[1] === "") {
    // "bytes=-500": los últimos 500.
    const ultimos = Number(m[2]);
    if (ultimos === 0) return { invalido: true };
    desde = Math.max(0, tamano - ultimos);
    hasta = tamano - 1;
  } else {
    desde = Number(m[1]);
    hasta = m[2] === "" ? tamano - 1 : Math.min(Number(m[2]), tamano - 1);
  }

  if (desde >= tamano || hasta < desde) return { invalido: true };

  const parte = Math.floor(desde / TAMANO_PARTE);
  const finDeParte = (parte + 1) * TAMANO_PARTE - 1;
  return { desde, hasta: Math.min(hasta, finDeParte), parte };
}

export { esDueno, respuestaJson, respuestaPreflight } from "./_v2.mjs";
