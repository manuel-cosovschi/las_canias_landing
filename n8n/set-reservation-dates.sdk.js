// Workflow `set-reservation-dates` de n8n (copia versionada).
//
// Mueve una reserva de fechas. Lo llama el panel desde el calendario, vía la
// función set-reservation-dates de Netlify.
//
// El chequeo de solape vive acá y no en Netlify porque este nodo es el único
// que ve la planilla entera: sin eso, mover una reserva podría dejar dos
// ocupaciones encima en la misma casa.
//
// El valor real del secret está en el nodo de n8n, no acá.

import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    position: [0, 192],
    parameters: { httpMethod: 'POST', path: 'set-reservation-dates', responseMode: 'responseNode', options: {} },
  },
  output: [{ body: { id: 'X', check_in: '2027-01-24', check_out: '2027-01-31' }, headers: {} }],
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

const EXPECTED = "REEMPLAZAR_POR_EL_LC_OWNER_SECRET";
if (secret !== EXPECTED) {
  return [{ json: { ok: false, message: "Unauthorized (secret inválido)" } }];
}

const id = String(body.id || "").trim();
const ci = String(body.check_in || "").slice(0, 10);
const co = String(body.check_out || "").slice(0, 10);

if (!id) return [{ json: { ok: false, message: "Falta campo: id" } }];

const formato = /^\\d{4}-\\d{2}-\\d{2}$/;
if (!formato.test(ci) || !formato.test(co)) {
  return [{ json: { ok: false, message: "Las fechas tienen que venir como YYYY-MM-DD" } }];
}
if (co <= ci) {
  return [{ json: { ok: false, message: "La salida tiene que ser posterior a la entrada" } }];
}

return [{ json: { ok: true, id, check_in: ci, check_out: co } }];`,
    },
  },
  output: [{ ok: true, id: 'X', check_in: '2027-01-24', check_out: '2027-01-31' }],
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
  output: [{ id: 'X', house_code: 'LC3', status: 'CONFIRMED', check_in: '2027-01-24', check_out: '2027-01-31', rowNumber: 2 }],
});

const chequear = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'chequear solape',
    position: [896, 96],
    parameters: {
      jsCode: `const pedido = $items("validar pedido")[0]?.json || {};
const filas = ($items("Leer la planilla") || []).map(i => i?.json || {});

const laReserva = filas.find(r => String(r.id || "").trim() === pedido.id);
if (!laReserva) {
  return [{ json: { ok: false, found: false, message: "No se encontró la reserva", id: pedido.id } }];
}

const casa = String(laReserva.house_code || "").trim().toUpperCase();

// Sólo lo que realmente ocupa la casa. Una cancelada o vencida no estorba.
const OCUPAN = new Set(["CONFIRMED", "HOLD_TRANSFER", "BLOCKED"]);

const soloFecha = (v) => String(v || "").slice(0, 10);

const choque = filas.find((r) => {
  if (String(r.id || "").trim() === pedido.id) return false;
  if (String(r.house_code || "").trim().toUpperCase() !== casa) return false;
  if (!OCUPAN.has(String(r.status || "").trim().toUpperCase())) return false;

  const ci = soloFecha(r.check_in);
  const co = soloFecha(r.check_out);
  if (!ci || !co) return false;

  // El día de salida de una puede ser el de entrada de la otra: eso no pisa.
  return pedido.check_in < co && ci < pedido.check_out;
});

if (choque) {
  return [{ json: {
    ok: false, found: true,
    message: "Esas fechas se pisan con " + soloFecha(choque.check_in) + " a " + soloFecha(choque.check_out) +
             (choque.guest_name ? " (" + choque.guest_name + ")" : " (bloqueo)"),
  } }];
}

return [{ json: {
  ok: true, found: true,
  id: pedido.id,
  house_code: casa,
  check_in: pedido.check_in,
  check_out: pedido.check_out,
  antes: { check_in: soloFecha(laReserva.check_in), check_out: soloFecha(laReserva.check_out) },
} }];`,
    },
  },
  output: [{ ok: true, found: true, id: 'X', check_in: '2027-01-24', check_out: '2027-01-31' }],
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

const guardar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Guardar fechas',
    position: [1344, 0],
    parameters: {
      operation: 'update',
      documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', cachedResultName: 'Las Cañas - Reservas' },
      sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'reservas' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          id: '={{ $json.id }}',
          check_in: '={{ $json.check_in }}',
          check_out: '={{ $json.check_out }}',
        },
        matchingColumns: ['id'],
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'check_in', displayName: 'check_in', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'check_out', displayName: 'check_out', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      // RAW para que las fechas queden como texto YYYY-MM-DD y no las convierta
      // Google Sheets a su formato local.
      options: { cellFormat: 'RAW' },
    },
    credentials: { googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' } },
  },
  output: [{ id: 'X', check_in: '2027-01-24', check_out: '2027-01-31' }],
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

export default workflow('lc-set-reservation-dates', 'set-reservation-dates')
  .add(webhook)
  .to(validar)
  .to(siEsValido
    .onTrue(leerTodo.to(chequear).to(siSePuede.onTrue(guardar.to(responderOk)).onFalse(rechazar)))
    .onFalse(noAutorizado));
