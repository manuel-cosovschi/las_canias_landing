// netlify/functions/_tienda.js
// Guarda el catálogo de la tienda y las fotos de los productos.
//
// Mismo mecanismo que los comprobantes (_proofs.js): Netlify Blobs. Se eligió
// eso y no la planilla de reservas a propósito — la planilla lleva la
// ocupación y la plata de los alquileres, y ya nos mordió una vez leyendo
// hasta la columna Z. Meterle stock encima es pedirlo de nuevo.
//
// El catálogo entero va en una sola clave, como un JSON. Son decenas de
// productos, no miles: guardarlo junto evita quedarse a mitad de camino con
// media lista escrita, que es lo que pasa cuando cada producto es su propia
// escritura.
//
// Todo el trato con el almacenamiento pasa por acá: si algún día hay que
// mover esto a otro lado, se cambia este archivo y ninguna función se entera.
const STORE = "tienda";
const CLAVE_CATALOGO = "catalogo";

function getStore(name) {
  return require("@netlify/blobs").getStore(name);
}

function store() {
  return getStore(STORE);
}

// El id va en la URL de la foto y en la clave del blob: que no se cuele nada.
function idValido(id) {
  const limpio = String(id || "").trim();
  if (!limpio || limpio.length > 64) return null;
  if (!/^[a-z0-9-]+$/.test(limpio)) return null;
  return limpio;
}

const CATALOGO_VACIO = { publicada: false, productos: [] };

// Un producto guardado nunca es lo que llegó del navegador: se arma campo por
// campo. Así una clave de más en el pedido no termina en el almacenamiento.
function normalizarProducto(p) {
  const id = idValido(p && p.id);
  if (!id) return null;

  const nombre = String((p && p.nombre) || "").trim();
  if (!nombre || nombre.length > 120) return null;

  const precioCrudo = p && p.precio;
  // null y "" son "Consultar", que es un estado válido: hay cosas que se
  // cotizan. Un precio negativo no lo es.
  const precio =
    precioCrudo === null || precioCrudo === "" || precioCrudo === undefined
      ? null
      : Number(precioCrudo);
  if (precio !== null && (!Number.isFinite(precio) || precio < 0)) return null;

  return {
    id,
    nombre,
    descripcion: String((p && p.descripcion) || "").trim().slice(0, 400),
    precio,
    categoria: String((p && p.categoria) || "").trim().slice(0, 60),
    agotado: Boolean(p && p.agotado),
    // La foto no viene del navegador: se sabe si existe preguntándole al
    // almacenamiento, para que nadie pueda escribir una URL a mano.
    tieneFoto: Boolean(p && p.tieneFoto),
  };
}

function normalizarCatalogo(bruto) {
  const productos = [];
  const vistos = new Set();

  for (const p of Array.isArray(bruto && bruto.productos) ? bruto.productos : []) {
    const limpio = normalizarProducto(p);
    // Un id repetido pisaría la foto del otro: se corta acá y no después.
    if (!limpio || vistos.has(limpio.id)) continue;
    vistos.add(limpio.id);
    productos.push(limpio);
  }

  return { publicada: Boolean(bruto && bruto.publicada), productos };
}

async function leerCatalogo() {
  try {
    const crudo = await store().get(CLAVE_CATALOGO, { type: "json" });
    if (!crudo) return { ...CATALOGO_VACIO };
    return normalizarCatalogo(crudo);
  } catch (e) {
    console.error("leerCatalogo:", e?.message || e);
    // Que el almacenamiento falle no puede tumbar la landing entera: se
    // devuelve vacío y sin publicar, que es el estado seguro.
    return { ...CATALOGO_VACIO, error: true };
  }
}

async function guardarCatalogo(bruto) {
  const limpio = normalizarCatalogo(bruto);
  await store().set(CLAVE_CATALOGO, JSON.stringify(limpio), {
    metadata: { guardadoEn: new Date().toISOString(), cuantos: limpio.productos.length },
  });
  return limpio;
}

const claveFoto = (id) => `foto/${id}`;

async function guardarFoto(id, { buffer, contentType, filename }) {
  const limpio = idValido(id);
  if (!limpio) return { ok: false, message: "id de producto inválido" };
  if (!buffer || !buffer.length) return { ok: false, message: "archivo vacío" };

  try {
    await store().set(claveFoto(limpio), buffer, {
      metadata: {
        contentType: String(contentType || "application/octet-stream"),
        filename: String(filename || "foto"),
        size: buffer.length,
        subidaEn: new Date().toISOString(),
      },
    });
    return { ok: true };
  } catch (e) {
    console.error("guardarFoto:", e?.message || e);
    return { ok: false, message: e?.message || "Error guardando la foto" };
  }
}

async function leerFoto(id) {
  const limpio = idValido(id);
  if (!limpio) return null;

  const res = await store().getWithMetadata(claveFoto(limpio), { type: "arrayBuffer" });
  if (!res) return null;

  const meta = res.metadata || {};
  return {
    buffer: Buffer.from(res.data),
    contentType: String(meta.contentType || "application/octet-stream"),
  };
}

async function borrarFoto(id) {
  const limpio = idValido(id);
  if (!limpio) return;
  try {
    await store().delete(claveFoto(limpio));
  } catch (e) {
    // Una foto huérfana no rompe nada; el producto ya no está.
    console.error("borrarFoto:", e?.message || e);
  }
}

// Cuáles tienen foto de verdad. Se le pregunta al almacenamiento en vez de
// creerle al catálogo: si no, un producto quedaría mostrando el hueco de una
// foto que nunca se subió, o que se borró por otro lado.
async function cualesTienenFoto(ids) {
  let s;
  try {
    s = store();
  } catch (e) {
    console.error("cualesTienenFoto: almacenamiento no disponible:", e?.message || e);
    return new Set();
  }

  const conFoto = new Set();
  await Promise.all(
    (ids || []).map(async (id) => {
      const limpio = idValido(id);
      if (!limpio) return;
      try {
        if (await s.getMetadata(claveFoto(limpio))) conFoto.add(limpio);
      } catch (e) {
        console.error("cualesTienenFoto:", limpio, e?.message || e);
      }
    })
  );
  return conFoto;
}

module.exports = {
  idValido,
  normalizarCatalogo,
  leerCatalogo,
  guardarCatalogo,
  guardarFoto,
  leerFoto,
  borrarFoto,
  cualesTienenFoto,
};
