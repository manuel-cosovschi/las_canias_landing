// Workflow `set-reservation-status` de n8n (copia versionada).
//
// Corrige el estado de una reserva en la planilla y NADA MÁS. Existe porque no
// había forma de deshacer una cancelación: cancel-confirmed cancela y avisa,
// pero no hay vuelta atrás, y admin-update-reservation apunta a un webhook que
// no está registrado en n8n.
//
// **No manda ningún mail, a propósito.** Se usa para corregir errores
// administrativos, y avisarle al huésped de una corrección sólo lo confunde.
// Si lo que hace falta es avisarle algo al huésped, eso va por su flujo.
//
// El valor real del secret está en el nodo de n8n, no acá.

import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    position: [0, 192],
    parameters: { httpMethod: 'POST', path: 'set-reservation-status', responseMode: 'responseNode', options: {} },
  },
  output: [{ body: { id: 'X', status: 'CONFIRMED' }, headers: {} }],
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

const id = String(body.id || "").trim();
const status = String(body.status || "").trim().toUpperCase();

if (!id) return [{ json: { ok: false, message: "Falta campo: id" } }];

const PERMITIDOS = ["CONFIRMED", "CANCELLED", "BLOCKED"];
if (!PERMITIDOS.includes(status)) {
  return [{ json: { ok: false, message: "Status inválido. Usá: " + PERMITIDOS.join(", ") } }];
}

return [{ json: { ok: true, id, status, status_reason: String(body.reason || "").slice(0, 300) } }];`,
    },
  },
  output: [{ ok: true, id: 'X', status: 'CONFIRMED' }],
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

const guardar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Guardar estado',
    position: [672, 96],
    parameters: {
      operation: 'update',
      documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', cachedResultName: 'Las Cañas - Reservas' },
      sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'reservas' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          id: '={{ $json.id }}',
          status: '={{ $json.status }}',
          status_reason: '={{ $json.status_reason }}',
          status_updated_at: '={{ $now.toISO() }}',
        },
        matchingColumns: ['id'],
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status_reason', displayName: 'status_reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status_updated_at', displayName: 'status_updated_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      options: { cellFormat: 'RAW' },
    },
    credentials: { googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' } },
  },
  output: [{ id: 'X', status: 'CONFIRMED' }],
});

const responderOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Respond to Webhook', position: [896, 96], parameters: { respondWith: 'json', responseBody: '={{ { "ok": true, "id": $json.id, "status": $json.status } }}', options: {} } },
  output: [{ ok: true }],
});

const rechazar = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Rechazado', position: [672, 288], parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 400 } } },
  output: [{ ok: false }],
});

export default workflow('lc-set-reservation-status', 'set-reservation-status')
  .add(webhook)
  .to(validar)
  .to(siEsValido.onTrue(guardar.to(responderOk)).onFalse(rechazar));
