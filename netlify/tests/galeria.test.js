// node --test netlify/tests/galeria.test.js
//
// Las fotos de las casas, de punta a punta: se sube un video en partes como
// lo hace el panel, se guarda en una casa, se pide con Range como lo pide el
// navegador, y se comprueba que lo que se saca se borra.
//
// Contra un almacenamiento de verdad, no uno de mentira: BlobsServer es el
// servidor local que trae @netlify/blobs. Lo que se prueba son las funciones
// tal cual las llama Netlify, con un Request y una Response.
//
// Es .js (CommonJS) para que lo agarre el glob de `npm test`; las funciones
// son ESM y se cargan con import().

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SECRET = "secreto-de-prueba";
const BASE = "https://lascanias.test";

let server;
let directorio;
let m; // módulos

test.before(async () => {
  const { BlobsServer } = await import("@netlify/blobs/server");
  const { setEnvironmentContext } = await import("@netlify/blobs");

  directorio = fs.mkdtempSync(path.join(os.tmpdir(), "galeria-test-"));
  server = new BlobsServer({ directory: directorio, token: "tok", port: 0 });
  const { port } = await server.start();
  const url = `http://localhost:${port}`;
  setEnvironmentContext({ siteID: "sitio", token: "tok", edgeURL: url, uncachedEdgeURL: url });
  process.env.LC_OWNER_SECRET = SECRET;

  m = {
    galeria: await import("../functions/_galeria.mjs"),
    leer: (await import("../functions/house-gallery.mjs")).default,
    guardar: (await import("../functions/set-house-gallery.mjs")).default,
    subir: (await import("../functions/upload-house-media.mjs")).default,
    servir: (await import("../functions/house-media.mjs")).default,
  };
});

test.after(async () => {
  await server.stop();
  fs.rmSync(directorio, { recursive: true, force: true });
});

const dueno = { "x-lc-secret": SECRET };

async function subirArchivo(id, bytes, tipo) {
  const { TAMANO_PARTE } = m.galeria;
  const total = Math.max(1, Math.ceil(bytes.length / TAMANO_PARTE));
  let ultima;
  for (let n = 0; n < total; n++) {
    const q = new URLSearchParams({ id, n: String(n), total: String(total), tipo, tamano: String(bytes.length) });
    const res = await m.subir(
      new Request(`${BASE}/api/upload-house-media?${q}`, {
        method: "POST",
        headers: dueno,
        body: bytes.subarray(n * TAMANO_PARTE, (n + 1) * TAMANO_PARTE),
      })
    );
    ultima = { status: res.status, body: await res.json() };
    if (res.status !== 200) return ultima;
  }
  return ultima;
}

function bytesDePrueba(largo) {
  const b = new Uint8Array(largo);
  for (let i = 0; i < largo; i++) b[i] = (i * 31 + 7) % 251;
  return b;
}

async function guardar(casa, items, headers = dueno) {
  const res = await m.guardar(
    new Request(`${BASE}/api/set-house-gallery`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ casa, items }),
    })
  );
  return { status: res.status, body: await res.json() };
}

async function galeria() {
  const res = await m.leer(new Request(`${BASE}/api/house-gallery`));
  return res.json();
}

async function pedir(id, range) {
  const headers = range ? { range } : {};
  const res = await m.servir(new Request(`${BASE}/api/house-media?id=${id}`, { headers }));
  return { res, bytes: new Uint8Array(await res.arrayBuffer()) };
}

// ---------- reglas sueltas ----------

test("rangoPedido: nunca más de una parte por respuesta", () => {
  const { rangoPedido, TAMANO_PARTE: P } = m.galeria;
  const tamano = 2 * P + 100;

  assert.deepStrictEqual(rangoPedido("bytes=0-", tamano), { desde: 0, hasta: P - 1, parte: 0 });
  assert.deepStrictEqual(rangoPedido("bytes=0-1", tamano), { desde: 0, hasta: 1, parte: 0 });
  assert.deepStrictEqual(rangoPedido(`bytes=${P}-`, tamano), { desde: P, hasta: 2 * P - 1, parte: 1 });
  // Un pedido que cruza dos partes se corta en el borde: el navegador pide el resto.
  assert.deepStrictEqual(rangoPedido(`bytes=${P - 10}-${P + 10}`, tamano), { desde: P - 10, hasta: P - 1, parte: 0 });
  // Los últimos 50 bytes.
  assert.deepStrictEqual(rangoPedido("bytes=-50", tamano), { desde: tamano - 50, hasta: tamano - 1, parte: 2 });
  // Un fin más allá del archivo se recorta.
  assert.deepStrictEqual(rangoPedido(`bytes=${2 * P}-999999999`, tamano), { desde: 2 * P, hasta: tamano - 1, parte: 2 });

  assert.deepStrictEqual(rangoPedido(`bytes=${tamano}-`, tamano), { invalido: true });
  assert.deepStrictEqual(rangoPedido("bytes=-0", tamano), { invalido: true });
  assert.strictEqual(rangoPedido(null, tamano), null);
  assert.strictEqual(rangoPedido("bytes=", tamano), null);
  assert.strictEqual(rangoPedido("bytes=0-1,5-6", tamano), null);
});

test("normalizarLista: sólo caminos de las carpetas de las casas, sin repetidos", () => {
  const { normalizarLista } = m.galeria;
  const lista = normalizarLista([
    { origen: "original", src: "/Casa 1 Imagenes/Baño1LC1.jpeg" },
    { origen: "original", src: "/Casa 1 Imagenes/Baño1LC1.jpeg" },
    { origen: "original", src: "https://otro.sitio/foto.jpg" },
    { origen: "original", src: "/Casa 1 Imagenes/../admin.html" },
    { origen: "original", src: "/Casa 9 Imagenes/x.jpeg" },
    { origen: "subida", id: "abc-123" },
    { origen: "subida", id: "../meta/x" },
    { origen: "subida", id: "abc-123", extra: "no se guarda" },
    { origen: "otra cosa" },
    null,
  ]);
  assert.deepStrictEqual(lista, [
    { origen: "original", src: "/Casa 1 Imagenes/Baño1LC1.jpeg" },
    { origen: "subida", id: "abc-123" },
  ]);
});

test("problemaDeSubida: tipos y tamaños", () => {
  const { problemaDeSubida, MAXIMO_VIDEO } = m.galeria;
  assert.strictEqual(problemaDeSubida({ tipo: "image/jpeg", tamano: 500000 }), null);
  assert.strictEqual(problemaDeSubida({ tipo: "video/quicktime", tamano: 80e6 }), null);
  assert.ok(problemaDeSubida({ tipo: "text/html", tamano: 10 }));
  assert.ok(problemaDeSubida({ tipo: "image/jpeg", tamano: 5 * 1024 * 1024 }));
  assert.ok(problemaDeSubida({ tipo: "video/mp4", tamano: MAXIMO_VIDEO + 1 }));
  assert.ok(problemaDeSubida({ tipo: "video/mp4", tamano: 0 }));
});

// ---------- de punta a punta ----------

test("sin dueño no se sube ni se guarda", async () => {
  const q = new URLSearchParams({ id: "x1", n: "0", total: "1", tipo: "image/jpeg", tamano: "3" });
  const res = await m.subir(new Request(`${BASE}/api/upload-house-media?${q}`, { method: "POST", body: new Uint8Array(3) }));
  assert.strictEqual(res.status, 401);

  const g = await guardar(1, [{ origen: "original", src: "/Casa 1 Imagenes/PasilloLC1.jpeg" }], {});
  assert.strictEqual(g.status, 401);
});

test("video en tres partes: se sube, se guarda en la casa y se sirve con Range", async () => {
  const { TAMANO_PARTE: P } = m.galeria;
  const video = bytesDePrueba(2 * P + 12345);

  const subida = await subirArchivo("video-uno", video, "video/mp4");
  assert.strictEqual(subida.status, 200, JSON.stringify(subida.body));
  assert.strictEqual(subida.body.completo, true);

  // Subido no quiere decir publicado: la galería todavía no lo tiene.
  assert.deepStrictEqual((await galeria()).casas, {});

  const g = await guardar(3, [
    { origen: "original", src: "/Casa 3 Imagenes/EntradaLC3.jpeg" },
    { origen: "subida", id: "video-uno" },
  ]);
  assert.strictEqual(g.status, 200, JSON.stringify(g.body));
  assert.strictEqual(g.body.guardados, 2);

  const gal = await galeria();
  assert.deepStrictEqual(gal.casas["3"], [
    { origen: "original", src: "/Casa 3 Imagenes/EntradaLC3.jpeg", video: false },
    { origen: "subida", id: "video-uno", src: "/api/house-media?id=video-uno", video: true },
  ]);

  // Lo primero que pide Safari: dos bytes, para ver si hay Range.
  let r = await pedir("video-uno", "bytes=0-1");
  assert.strictEqual(r.res.status, 206);
  assert.strictEqual(r.res.headers.get("content-range"), `bytes 0-1/${video.length}`);
  assert.deepStrictEqual([...r.bytes], [...video.subarray(0, 2)]);

  // Y después lo va pidiendo de a pedazos: armado, tiene que dar el archivo.
  const armado = [];
  let desde = 0;
  while (desde < video.length) {
    r = await pedir("video-uno", `bytes=${desde}-`);
    assert.strictEqual(r.res.status, 206);
    assert.ok(r.bytes.length <= P, "más de una parte en una respuesta");
    assert.strictEqual(r.res.headers.get("content-type"), "video/mp4");
    armado.push(r.bytes);
    desde += r.bytes.length;
  }
  assert.deepStrictEqual(Buffer.concat(armado), Buffer.from(video));

  // Sin Range (un link abierto a mano) va entero, en streaming.
  r = await pedir("video-uno");
  assert.strictEqual(r.res.status, 200);
  assert.deepStrictEqual(Buffer.from(r.bytes), Buffer.from(video));

  r = await pedir("video-uno", `bytes=${video.length}-`);
  assert.strictEqual(r.res.status, 416);
});

test("un id ya subido no se pisa", async () => {
  const foto = bytesDePrueba(1000);
  assert.strictEqual((await subirArchivo("foto-fija", foto, "image/jpeg")).status, 200);
  const otra = await subirArchivo("foto-fija", bytesDePrueba(1000).reverse(), "image/jpeg");
  assert.strictEqual(otra.status, 409);

  const r = await pedir("foto-fija");
  assert.deepStrictEqual(Buffer.from(r.bytes), Buffer.from(foto));
});

test("una parte que llega cortada se rechaza", async () => {
  const { TAMANO_PARTE: P } = m.galeria;
  const q = new URLSearchParams({ id: "corta", n: "0", total: "2", tipo: "video/mp4", tamano: String(P + 10) });
  const res = await m.subir(
    new Request(`${BASE}/api/upload-house-media?${q}`, { method: "POST", headers: dueno, body: new Uint8Array(100) })
  );
  assert.strictEqual(res.status, 400);
});

test("una subida a medias no entra en la casa ni se sirve", async () => {
  const { TAMANO_PARTE: P } = m.galeria;
  const video = bytesDePrueba(P + 10);
  const q = new URLSearchParams({ id: "a-medias", n: "0", total: "2", tipo: "video/mp4", tamano: String(video.length) });
  const res = await m.subir(
    new Request(`${BASE}/api/upload-house-media?${q}`, { method: "POST", headers: dueno, body: video.subarray(0, P) })
  );
  assert.strictEqual(res.status, 200);

  assert.strictEqual((await pedir("a-medias", "bytes=0-")).res.status, 404);

  const g = await guardar(2, [
    { origen: "original", src: "/Casa 2 Imagenes/EntradaLC2.jpeg" },
    { origen: "subida", id: "a-medias" },
  ]);
  assert.strictEqual(g.body.recibidos, 2);
  assert.strictEqual(g.body.guardados, 1);
});

test("lo que se saca de la casa se borra; volver a las originales borra lo subido", async () => {
  const foto = bytesDePrueba(2000);
  assert.strictEqual((await subirArchivo("foto-dos", foto, "image/jpeg")).status, 200);

  let g = await guardar(3, [
    { origen: "subida", id: "foto-dos" },
    { origen: "subida", id: "video-uno" },
  ]);
  assert.strictEqual(g.body.guardados, 2);

  // Se saca el video: tiene que dejar de existir.
  g = await guardar(3, [{ origen: "subida", id: "foto-dos" }]);
  assert.strictEqual(g.status, 200);
  assert.ok(g.body.archivosBorrados >= 1);
  assert.strictEqual((await pedir("video-uno", "bytes=0-")).res.status, 404);
  assert.strictEqual((await pedir("foto-dos")).res.status, 200);

  // Volver a las originales: la casa sale de la galería y su foto se borra.
  g = await guardar(3, null);
  assert.strictEqual(g.status, 200);
  assert.strictEqual(g.body.originales, true);
  assert.strictEqual((await galeria()).casas["3"], undefined);
  assert.strictEqual((await pedir("foto-dos")).res.status, 404);
});

test("una casa no puede quedar vacía ni recibir una casa que no existe", async () => {
  assert.strictEqual((await guardar(1, [])).status, 400);
  assert.strictEqual((await guardar(7, [{ origen: "original", src: "/Casa 1 Imagenes/PasilloLC1.jpeg" }])).status, 400);
});
