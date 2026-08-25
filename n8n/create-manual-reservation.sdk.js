// Workflow `create-manual-reservation` de n8n (copia versionada).
//
// Carga una reserva a mano desde el panel: la que entró por teléfono o
// WhatsApp y nunca pasó por la web. Es la fila que antes escribían en el Excel.
//
// No confundir con create-reservation, que es el alta pública: aquella nace
// PENDING y con vencimiento, ésta nace CONFIRMED porque el dueño ya sabe que
// está cerrada. Y no manda ningún mail: el huésped ya arregló por otro lado.
//
// El chequeo de solape vive acá y no en Netlify porque este nodo es el único
// que ve la planilla entera: sin eso, cargar a mano podría dejar dos
// ocupaciones encima en la misma casa, que es justo el error que el Excel
// dejaba pasar.
//
// El valor real del secret está en el nodo de n8n, no acá.

import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    position: [0, 192],
    parameters: { httpMethod: 'POST', path: 'create-manual-reservation', responseMode: 'responseNode', options: {} },
  },
  output: [{ body: { house_code: 'LC2', check_in: '2027-02-10', check_out: '2027-02-17', guest_name: 'Marta Suárez' }, headers: {} }],
});

const validar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'validar pedido',
    position: [224, 192],
    parameters: {
      jsCode: `const wh = $items("Webhook")?.[0]?.json || {};
const body = wh.body || wh;
const headers = wh.headers || {};

const secret =
  headers["x-lc-secret"] ||
  headers["X-Lc-Secret"] ||
  headers["X-LC-SECRET"] ||
  "";

if (secret !== "REEMPLAZAR_POR_EL_LC_OWNER_SECRET") {
  return [{ json: { ok: false, message: "Unauthorized (secret inválido)" } }];
}

const casa = String(body.house_code || "").trim().toUpperCase();
const ci = String(body.check_in || "").slice(0, 10);
const co = String(body.check_out || "").slice(0, 10);
const nombre = String(body.guest_name || "").trim();

const CASAS = ["LC1", "LC2", "LC3", "LC4", "LC5"];
if (!CASAS.includes(casa)) {
  return [{ json: { ok: false, message: "Casa inválida" } }];
}

const formato = /^\\d{4}-\\d{2}-\\d{2}$/;
if (!formato.test(ci) || !formato.test(co)) {
  return [{ json: { ok: false, message: "Las fechas tienen que venir como YYYY-MM-DD" } }];
}
if (co <= ci) {
  return [{ json: { ok: false, message: "La salida tiene que ser posterior a la entrada" } }];
}
if (!nombre) {
  return [{ json: { ok: false, message: "Falta el nombre del huésped" } }];
}

// Vacío queda vacío: una reserva puede cargarse sin el importe todavía.
const plata = (v) => {
  if (v === undefined || v === null || String(v).trim() === "") return "";
  const n = Number(String(v).replace(/[^\\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

const importe = plata(body.importe);
const anticipo = plata(body.anticipo);
if (importe === null) return [{ json: { ok: false, message: "Importe inválido" } }];
if (anticipo === null) return [{ json: { ok: false, message: "Seña inválida" } }];
if (importe !== "" && anticipo !== "" && anticipo > importe) {
  return [{ json: { ok: false, message: "La seña no puede ser mayor que el importe total" } }];
}

return [{ json: {
  ok: true,
  house_code: casa,
  check_in: ci,
  check_out: co,
  guest_name: nombre,
  dni: String(body.dni || "").trim(),
  phone: String(body.phone || "").trim(),
  email: String(body.email || "").trim(),
  importe: importe,
  anticipo: anticipo,
} }];`,
    },
  },
  output: [{ ok: true, house_code: 'LC2', check_in: '2027-02-10', check_out: '2027-02-17', guest_name: 'Marta Suárez' }],
});

const siEsValido = ifElse({
  version: 2.3,
  config: {
    name: 'If',
    position: [448, 192],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [{ leftValue: '={{ $json.ok }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
      options: {},
    },
  },
  output: [{ ok: true }],
});

const leerTodo = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Leer la planilla',
    position: [672, 96],
    parameters: {
      documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', cachedResultName: 'Las Cañas - Reservas' },
      sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'reservas' },
      options: {},
    },
    alwaysOutputData: true,
    credentials: { googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' } },
  },
  output: [{ id: 'X', house_code: 'LC2', status: 'CONFIRMED', check_in: '2027-01-05', check_out: '2027-01-12' }],
});

const chequear = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'chequear solape y armar fila',
    position: [896, 96],
    parameters: {
      jsCode: `const pedido = $items("validar pedido")[0]?.json || {};
const filas = ($items("Leer la planilla") || []).map(i => i?.json || {});

const soloFecha = (v) => String(v || "").slice(0, 10);

// Sólo lo que realmente ocupa la casa. Una cancelada o vencida no estorba.
const OCUPAN = new Set(["CONFIRMED", "HOLD_TRANSFER", "BLOCKED"]);

const choque = filas.find((r) => {
  if (String(r.house_code || "").trim().toUpperCase() !== pedido.house_code) return false;
  if (!OCUPAN.has(String(r.status || "").trim().toUpperCase())) return false;
  const ci = soloFecha(r.check_in);
  const co = soloFecha(r.check_out);
  if (!ci || !co) return false;
  // El día de salida de una puede ser el de entrada de la otra: eso no pisa.
  return pedido.check_in < co && ci < pedido.check_out;
});

if (choque) {
  return [{ json: { ok: false, message:
    "Esas fechas se pisan con " + soloFecha(choque.check_in) + " a " + soloFecha(choque.check_out) +
    (choque.guest_name ? " (" + choque.guest_name + ")" : " (bloqueo)") } }];
}

// Id propio, distinto del XL- de la migración y del de la web, para que se
// sepa de dónde salió cada reserva.
const base = "MAN-" + pedido.house_code + "-" + pedido.check_in;
let id = base;
let n = 2;
const usados = new Set(filas.map(r => String(r.id || "").trim()));
while (usados.has(id)) { id = base + "-" + n; n++; }

const ahora = new Date().toISOString();

return [{ json: {
  ok: true,
  id,
  status: "CONFIRMED",
  source: "manual",
  house_code: pedido.house_code,
  check_in: pedido.check_in,
  check_out: pedido.check_out,
  guest_name: pedido.guest_name,
  dni: pedido.dni,
  phone: pedido.phone,
  email: pedido.email,
  importe: pedido.importe,
  anticipo: pedido.anticipo,
  notes: "Cargada a mano desde el panel",
  created_at: ahora,
  approved_at: ahora,
} }];`,
    },
  },
  output: [{ ok: true, id: 'MAN-LC2-2027-02-10', status: 'CONFIRMED', source: 'manual' }],
});

const siSePuede = ifElse({
  version: 2.3,
  config: {
    name: 'If se puede',
    position: [1120, 96],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [{ leftValue: '={{ $json.ok }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
      options: {},
    },
  },
  output: [{ ok: true }],
});

const agregar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Agregar a la planilla',
    position: [1344, 0],
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', cachedResultName: 'Las Cañas - Reservas' },
      sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'reservas' },
      columns: {
        mappingMode: 'autoMapInputData',
        value: {},
        schema: [
          'id', 'status', 'source', 'house_code', 'check_in', 'check_out',
          'guest_name', 'dni', 'phone', 'email', 'importe', 'anticipo',
          'notes', 'created_at', 'approved_at',
        ].map((c) => ({
          id: c, displayName: c, required: false, defaultMatch: c === 'id',
          display: true, type: 'string', canBeUsedToMatch: true,
        })),
      },
      // RAW para que las fechas queden como texto YYYY-MM-DD y no las convierta
      // Google Sheets a su formato local. `ignoreIt` descarta un campo que no
      // exista en la planilla en vez de crear una columna nueva.
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt', useAppend: true },
    },
    credentials: { googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' } },
  },
  output: [{ id: 'MAN-LC2-2027-02-10', check_in: '2027-02-10', check_out: '2027-02-17' }],
});

const responderOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Respond to Webhook', position: [1568, 0], parameters: { respondWith: 'json', responseBody: '={{ { "ok": true, "id": $json.id, "check_in": $json.check_in, "check_out": $json.check_out } }}', options: {} } },
  output: [{ ok: true }],
});

const rechazar = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'No se puede', position: [1344, 192], parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 409 } } },
  output: [{ ok: false }],
});

const noAutorizado = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'No autorizado', position: [672, 288], parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 400 } } },
  output: [{ ok: false }],
});

export default workflow('lc-create-manual-reservation', 'create-manual-reservation')
  .add(webhook)
  .to(validar)
  .to(siEsValido
    .onTrue(leerTodo.to(chequear).to(siSePuede.onTrue(agregar.to(responderOk)).onFalse(rechazar)))
    .onFalse(noAutorizado));
