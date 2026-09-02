// Workflow `owner-unblock-v2` de n8n (copia versionada).
//
// Libera fechas: pasa a CANCELLED los bloqueos de esa casa que pisan el rango
// pedido, y devuelve cuántos rangos liberó de verdad.
//
// El "v2" no es un capricho. El owner-unblock original contestaba siempre
// {"ok":true,"deleted_count":"=1"} —un texto fijo, con la expresión de n8n sin
// resolver— sin tocar la planilla. Como el panel le creía a esa respuesta, el
// dueño veía el tilde verde y la fecha seguía bloqueada, tanto desde "Bloquear
// fechas" como desde el calendario. El flujo viejo no se podía leer ni editar
// desde acá, así que se rehízo entero y la función de Netlify apunta al nuevo.
//
// Dos decisiones que sostienen todo lo demás:
//
// 1) Solo toca filas con status BLOCKED. Una reserva confirmada no se
//    desbloquea por acá: para eso está cancelar, que además avisa al huésped.
// 2) El contador sale de las filas que Google Sheets escribió, no de un número
//    puesto a mano. Ese fue exactamente el bug del flujo anterior, y es lo que
//    le permite al panel distinguir "liberé 2 rangos" de "no había nada".
//
// El valor real del secret está en el nodo de n8n, no acá.

import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    position: [0, 192],
    parameters: { httpMethod: 'POST', path: 'owner-unblock-v2', responseMode: 'responseNode', options: {} },
  },
  output: [{ body: { house_code: 'LC1', checkin: '2030-06-01', checkout: '2030-06-03' }, headers: {} }],
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
  return [{ json: { ok: false, message: "Unauthorized (secret invalido)" } }];
}

const casa = String(body.house_code || "").trim().toUpperCase();
const ci = String(body.checkin || body.check_in || "").slice(0, 10);
const co = String(body.checkout || body.check_out || "").slice(0, 10);

if (!casa) return [{ json: { ok: false, message: "Falta house_code" } }];

const formato = /^\\d{4}-\\d{2}-\\d{2}$/;
if (!formato.test(ci) || !formato.test(co)) {
  return [{ json: { ok: false, message: "Las fechas tienen que venir como YYYY-MM-DD" } }];
}
if (co <= ci) {
  return [{ json: { ok: false, message: "La salida tiene que ser posterior a la entrada" } }];
}

return [{ json: { ok: true, house_code: casa, checkin: ci, checkout: co } }];`,
    },
  },
  output: [{ ok: true, house_code: 'LC1', checkin: '2030-06-01', checkout: '2030-06-03' }],
});

const siAutorizado = ifElse({
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

const leer = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Leer la planilla',
    position: [672, 96],
    parameters: {
      documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', cachedResultName: 'Las Canas - Reservas' },
      sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'reservas' },
      options: {},
    },
    alwaysOutputData: true,
    credentials: { googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' } },
  },
  output: [{ id: 'BLQ-LC1-2030-06-01', house_code: 'LC1', status: 'BLOCKED', check_in: '2030-06-01', check_out: '2030-06-03' }],
});

const buscar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'buscar bloqueos que pisan',
    position: [896, 96],
    parameters: {
      jsCode: `const pedido = $items("validar pedido")[0]?.json || {};
const filas = ($items("Leer la planilla") || []).map(i => i?.json || {});

const soloFecha = (v) => String(v || "").slice(0, 10);

// Solo los bloqueos de esa casa. Una reserva confirmada no se desbloquea:
// para eso esta cancelar, que avisa al huesped.
const tocan = filas.filter((r) => {
  if (String(r.house_code || "").trim().toUpperCase() !== pedido.house_code) return false;
  if (String(r.status || "").trim().toUpperCase() !== "BLOCKED") return false;

  const ci = soloFecha(r.check_in);
  const co = soloFecha(r.check_out);
  if (!ci || !co) return false;

  // El dia de salida de uno puede ser el de entrada del otro: eso no pisa.
  return pedido.checkin < co && ci < pedido.checkout;
});

if (!tocan.length) {
  return [{ json: { ok: true, encontrados: 0, deleted_count: 0, cancelados: [],
                    message: "No habia ningun bloqueo en esas fechas" } }];
}

// Un item por fila: el nodo de Sheets actualiza una por cada item que entra.
return tocan.map((r) => ({
  json: {
    ok: true,
    encontrados: tocan.length,
    id: String(r.id || "").trim(),
    status: "CANCELLED",
    check_in: soloFecha(r.check_in),
    check_out: soloFecha(r.check_out),
  },
}));`,
    },
  },
  output: [{ ok: true, encontrados: 1, id: 'BLQ-LC1-2030-06-01', status: 'CANCELLED' }],
});

const siHayAlgo = ifElse({
  version: 2.3,
  config: {
    name: 'If hay algo',
    position: [1120, 96],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [{ leftValue: '={{ $json.encontrados }}', rightValue: 0, operator: { type: 'number', operation: 'gt' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
      options: {},
    },
  },
  output: [{ encontrados: 1 }],
});

const cancelar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Cancelar los bloqueos',
    position: [1344, 0],
    parameters: {
      operation: 'update',
      documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', cachedResultName: 'Las Canas - Reservas' },
      sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'reservas' },
      columns: {
        mappingMode: 'defineBelow',
        value: { id: '={{ $json.id }}', status: '={{ $json.status }}' },
        matchingColumns: ['id'],
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      options: { cellFormat: 'RAW' },
    },
    credentials: { googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' } },
  },
  output: [{ id: 'BLQ-LC1-2030-06-01', status: 'CANCELLED' }],
});

const contar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'contar lo que se cancelo',
    position: [1568, 0],
    parameters: {
      jsCode: `// El contador sale de las filas que el nodo de Sheets escribio de verdad,
// no de un numero escrito a mano. La version anterior devolvia siempre
// {"ok":true,"deleted_count":"=1"} aunque no hubiera tocado nada, y por eso
// el panel decia que habia desbloqueado cuando la fecha seguia bloqueada.
const escritas = ($items("Cancelar los bloqueos") || []).map(i => i?.json || {});
const pedidas = ($items("buscar bloqueos que pisan") || []).map(i => i?.json || {});

const cancelados = pedidas
  .filter(r => r.id)
  .map(r => ({ id: r.id, check_in: r.check_in, check_out: r.check_out }));

return [{ json: {
  ok: true,
  deleted_count: escritas.length,
  cancelados,
  message: escritas.length === 1
    ? "Se desbloqueo 1 rango"
    : "Se desbloquearon " + escritas.length + " rangos",
} }];`,
    },
  },
  output: [{ ok: true, deleted_count: 1, message: 'Se desbloqueo 1 rango' }],
});

const responderOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    position: [1792, 0],
    parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} },
  },
  output: [{ ok: true }],
});

// Cero desbloqueados sale por acá, con 200 y deleted_count 0: no es un error
// del servidor, pero tampoco un éxito, y el panel lo muestra como aviso.
const noHabiaNada = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'No habia nada',
    position: [1344, 192],
    parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} },
  },
  output: [{ ok: true, deleted_count: 0 }],
});

const noAutorizado = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'No autorizado',
    position: [672, 288],
    parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 401 } },
  },
  output: [{ ok: false }],
});

export default workflow('owner-unblock-v2', 'owner-unblock-v2')
  .add(webhook)
  .to(validar)
  .to(siAutorizado
    .onTrue(leer.to(buscar).to(siHayAlgo
      .onTrue(cancelar.to(contar).to(responderOk))
      .onFalse(noHabiaNada)))
    .onFalse(noAutorizado));
