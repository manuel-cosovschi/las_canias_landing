// Pruebas de `create-reservation--validar.js`, el nodo de n8n que decide si una
// solicitud de reserva se guarda o se rechaza.
//
// Se corre con node pelado, sin dependencias ni runner:
//
//     node n8n/create-reservation--validar.test.js
//
// Lee el archivo del nodo del repo y lo ejecuta con `new Function`, que es el
// mismo wrapper que usa n8n: se prueba el codigo que se publica, no una copia
// que puede quedar desincronizada.
//
// Es el unico archivo de pruebas del repo, y esta justo en este nodo porque es
// el que decide si una casa se bloquea seis horas.
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "create-reservation--validar.js");
const fuente = fs.readFileSync(SRC, "utf8");

// El secret real no esta en el repo: el archivo del nodo trae un placeholder y
// aca se reemplaza por uno de prueba. Lo que se valida es el mecanismo —que un
// secret que no coincide se rechace y uno que coincide pase— y eso no depende
// del valor.
const PLACEHOLDER = '"__SECRET_REAL_EN_EL_NODO_DE_N8N__"';
const SECRET = "secret-de-prueba";

if (!fuente.includes(PLACEHOLDER)) {
  console.error(
    `No encontre ${PLACEHOLDER} en create-reservation--validar.js.\n` +
    "Si el placeholder cambio, actualizalo aca. Si alguien escribio el secret\n" +
    "real en el archivo, sacalo: este repo es publico."
  );
  process.exit(1);
}

const code = fuente.replace(PLACEHOLDER, JSON.stringify(SECRET));

// Config tal como la devuelve /api/calendar-config hoy (copiada de la respuesta real)
const CONFIG_REAL = {
  first_date: "",
  last_date: "2027-03-31",
  default_min_nights: 2,
  fixed_windows: [
    { checkin: "2026-10-09", checkout: "2026-10-12", label: "Finde largo de octubre" },
    { checkin: "2026-11-20", checkout: "2026-11-23", label: "Finde largo de noviembre" },
    { checkin: "2026-12-04", checkout: "2026-12-08", label: "Finde largo de diciembre" },
  ],
  min_nights_rules: [],
};

function correr({ headers = {}, body = {}, config = CONFIG_REAL, sheetRows = [], configNodeMissing = false }) {
  const items = {
    Webhook: [{ json: { headers, body } }],
    "Get row(s) in sheet": sheetRows.map((r) => ({ json: r })),
    "Leer reglas del calendario": configNodeMissing
      ? undefined
      : [{ json: config === null ? { ok: false } : { ok: true, config } }],
  };

  const $items = (name) => {
    if (!(name in items) || items[name] === undefined) {
      throw new Error(`nodo inexistente: ${name}`);
    }
    return items[name];
  };

  const warnings = [];
  const fakeConsole = { warn: (m) => warnings.push(m), log: () => {}, error: () => {} };

  const fn = new Function("$items", "console", code);
  const out = fn($items, fakeConsole);
  return { json: out[0].json, warnings };
}

const base = {
  house_code: "LC4",
  guests: 2,
  guest_name: "T",
  dni: "1",
  email: "t@t.com",
  phone: "0",
  payment_method: "transfer",
};
const H = { "x-lc-secret": SECRET, "x-test-mode": "true" };

let pass = 0, fail = 0;
function check(nombre, cond, detalle) {
  if (cond) { pass++; console.log(`  ok   ${nombre}`); }
  else { fail++; console.log(`  FALLA ${nombre}${detalle ? ` -> ${detalle}` : ""}`); }
}

console.log("\n== 1. Secret ==");
{
  const r = correr({ headers: { "x-test-mode": "true" }, body: { ...base, checkin: "2026-11-28", checkout: "2026-12-02" } });
  check("sin secret -> rechaza", r.json.ok === false && /autorizado/i.test(r.json.message), JSON.stringify(r.json));
}
{
  const r = correr({ headers: { "x-lc-secret": "otro" }, body: { ...base, checkin: "2026-11-28", checkout: "2026-12-02" } });
  check("secret incorrecto -> rechaza", r.json.ok === false && /autorizado/i.test(r.json.message), JSON.stringify(r.json));
}
{
  const r = correr({ headers: { "X-LC-SECRET": SECRET, "x-test-mode": "true" }, body: { ...base, checkin: "2026-11-28", checkout: "2026-12-02" } });
  check("secret en mayusculas -> acepta", r.json.ok === true, JSON.stringify(r.json));
}
{
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-28", checkout: "2026-12-02" } });
  check("secret correcto + fechas validas -> acepta", r.json.ok === true && r.json.row.status === "HOLD_TRANSFER", JSON.stringify(r.json));
}

console.log("\n== 2. Ventana de reservas (regla nueva) ==");
{
  const r = correr({ headers: H, body: { ...base, checkin: "2027-05-01", checkout: "2027-05-04" } });
  check("checkin despues del tope -> rechaza", r.json.ok === false && /2027-03-31/.test(r.json.message), JSON.stringify(r.json));
}
{
  // ultima noche habilitada = 31/03; checkout la manana siguiente debe entrar
  const r = correr({ headers: H, body: { ...base, checkin: "2027-03-30", checkout: "2027-04-01" } });
  check("ultima noche habilitada -> acepta", r.json.ok === true, JSON.stringify(r.json));
}
{
  const r = correr({ headers: H, body: { ...base, checkin: "2027-03-30", checkout: "2027-04-02" } });
  check("checkout pasado el tope -> rechaza", r.json.ok === false && /2027-03-31/.test(r.json.message), JSON.stringify(r.json));
}
{
  const cfg = { ...CONFIG_REAL, first_date: "2026-11-01" };
  const r = correr({ headers: H, body: { ...base, checkin: "2026-10-20", checkout: "2026-10-23" }, config: cfg });
  check("antes de first_date -> rechaza", r.json.ok === false && /2026-11-01/.test(r.json.message), JSON.stringify(r.json));
}

console.log("\n== 3. Findes fijos (desde el panel) ==");
{
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-21", checkout: "2026-11-24" } });
  check("solapamiento parcial -> rechaza", r.json.ok === false && /Fechas fijas/.test(r.json.message), JSON.stringify(r.json));
}
{
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-20", checkout: "2026-11-23" } });
  check("rango exacto -> acepta", r.json.ok === true, JSON.stringify(r.json));
}
{
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-20", checkout: "2026-11-22" } });
  check("mismo checkin, checkout distinto -> rechaza", r.json.ok === false && /Fechas fijas/.test(r.json.message), JSON.stringify(r.json));
}
{
  // un finde que el panel NO tiene todavia: se agrega a la config y tiene que valer
  const cfg = { ...CONFIG_REAL, fixed_windows: [...CONFIG_REAL.fixed_windows, { checkin: "2027-02-12", checkout: "2027-02-15" }] };
  const r = correr({ headers: H, body: { ...base, checkin: "2027-02-13", checkout: "2027-02-16" }, config: cfg });
  check("finde nuevo cargado del panel -> rechaza", r.json.ok === false && /2027-02-12/.test(r.json.message), JSON.stringify(r.json));
}

console.log("\n== 4. Minimo de noches ==");
{
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-28", checkout: "2026-11-29" } });
  check("1 noche con minimo 2 -> rechaza", r.json.ok === false && /es de 2 noches/.test(r.json.message), JSON.stringify(r.json));
}
{
  const cfg = { ...CONFIG_REAL, min_nights_rules: [{ from: "2027-01-01", to: "2027-01-31", nights: 7 }] };
  const r = correr({ headers: H, body: { ...base, checkin: "2027-01-10", checkout: "2027-01-13" }, config: cfg });
  check("tramo con minimo 7 pisa al general -> rechaza", r.json.ok === false && /es de 7 noches/.test(r.json.message), JSON.stringify(r.json));
}
{
  const cfg = { ...CONFIG_REAL, min_nights_rules: [{ from: "2027-01-01", to: "2027-01-31", nights: 7 }] };
  const r = correr({ headers: H, body: { ...base, checkin: "2027-01-10", checkout: "2027-01-17" }, config: cfg });
  check("tramo con minimo 7, 7 noches -> acepta", r.json.ok === true, JSON.stringify(r.json));
}
{
  const cfg = { ...CONFIG_REAL, default_min_nights: 3 };
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-28", checkout: "2026-11-30" }, config: cfg });
  check("minimo general editado a 3 -> rechaza 2 noches", r.json.ok === false && /es de 3 noches/.test(r.json.message), JSON.stringify(r.json));
}

console.log("\n== 5. Config ilegible -> respaldo, no pasa todo ==");
{
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-21", checkout: "2026-11-24" }, config: null });
  check("endpoint caido: finde fijo sigue valiendo", r.json.ok === false && /Fechas fijas/.test(r.json.message), JSON.stringify(r.json));
  check("endpoint caido: avisa por consola", r.warnings.some(w => /respaldo/.test(w)), JSON.stringify(r.warnings));
}
{
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-28", checkout: "2026-11-29" }, config: null });
  check("endpoint caido: minimo 2 sigue valiendo", r.json.ok === false && /es de 2 noches/.test(r.json.message), JSON.stringify(r.json));
}
{
  // una sola ventana ilegible invalida toda la config, igual que en la pagina
  const cfg = { ...CONFIG_REAL, fixed_windows: [...CONFIG_REAL.fixed_windows, { checkin: "no-es-fecha", checkout: "2027-02-15" }] };
  const r = correr({ headers: H, body: { ...base, checkin: "2027-05-01", checkout: "2027-05-04" }, config: cfg });
  check("ventana ilegible -> usa respaldo (sin tope)", r.json.ok === true, JSON.stringify(r.json));
  check("ventana ilegible -> avisa", r.warnings.some(w => /respaldo/.test(w)), JSON.stringify(r.warnings));
}
{
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-28", checkout: "2026-12-02" }, configNodeMissing: true });
  check("nodo de config ausente -> no explota", r.json.ok === true, JSON.stringify(r.json));
}

console.log("\n== 6. Lo que ya validaba, sigue validando ==");
{
  const r = correr({ headers: H, body: { ...base, house_code: "LC5", guests: 5, checkin: "2026-11-28", checkout: "2026-12-02" } });
  check("mas personas que el maximo -> rechaza", r.json.ok === false && /Maximo 3|Máximo 3/.test(r.json.message), JSON.stringify(r.json));
}
{
  const r = correr({ headers: H, body: { ...base, house_code: "LC9", checkin: "2026-11-28", checkout: "2026-12-02" } });
  check("casa inexistente -> rechaza", r.json.ok === false && /inv/i.test(r.json.message), JSON.stringify(r.json));
}
{
  const r = correr({ headers: H, body: { ...base, checkin: "2026-12-02", checkout: "2026-11-28" } });
  check("checkout antes del checkin -> rechaza", r.json.ok === false && /posterior/.test(r.json.message), JSON.stringify(r.json));
}
{
  const r = correr({ headers: H, body: { ...base, email: "", checkin: "2026-11-28", checkout: "2026-12-02" } });
  check("falta email -> rechaza", r.json.ok === false && /Faltan campos/.test(r.json.message), JSON.stringify(r.json));
}
{
  const rows = [{ id: "X", house_code: "LC4", status: "CONFIRMED", check_in: "2026-11-29", check_out: "2026-12-01" }];
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-28", checkout: "2026-12-02" }, sheetRows: rows });
  check("fechas ya reservadas -> rechaza", r.json.ok === false && /no disponibles/.test(r.json.message), JSON.stringify(r.json));
}
{
  // un hold ya vencido no bloquea
  const rows = [{ id: "X", house_code: "LC4", status: "HOLD_TRANSFER", expires_at: "2020-01-01T00:00:00Z", check_in: "2026-11-29", check_out: "2026-12-01" }];
  const r = correr({ headers: H, body: { ...base, checkin: "2026-11-28", checkout: "2026-12-02" }, sheetRows: rows });
  check("hold vencido no bloquea -> acepta", r.json.ok === true, JSON.stringify(r.json));
}
{
  const r = correr({ headers: H, body: { ...base, payment_method: "card", checkin: "2026-11-28", checkout: "2026-12-02" } });
  check("card -> PENDING_PAYMENT sin expires", r.json.ok === true && r.json.row.status === "PENDING_PAYMENT" && r.json.row.expires_at === "", JSON.stringify(r.json));
}

console.log(`\n==== ${pass} ok, ${fail} fallan ====\n`);
process.exit(fail ? 1 : 0);
