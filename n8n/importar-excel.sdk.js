import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    position: [0, 192],
    parameters: {
      httpMethod: 'POST',
      path: 'importar-excel',
      responseMode: 'responseNode',
      options: {},
    },
  },
  output: [{ body: { rows: [] }, headers: { 'x-lc-secret': 'xxx' } }],
});

// La lectura tiene que pasar ANTES de validar: sin ver lo que ya está cargado,
// no hay forma de saber si una fila es nueva o es la misma de antes.
const leerTodo = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Leer la planilla',
    position: [224, 48],
    parameters: {
      documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', cachedResultName: 'Las Cañas - Reservas' },
      sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'reservas' },
      options: {},
    },
    alwaysOutputData: true,
    credentials: { googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' } },
  },
  output: [{ id: 'XL-2526-LC1-2025-12-05', house_code: 'LC1', status: 'CONFIRMED' }],
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

const rows = Array.isArray(body.rows) ? body.rows : [];
if (!rows.length) {
  return [{ json: { ok: false, message: "No vino ninguna fila" } }];
}

if (rows.length > 200) {
  return [{ json: { ok: false, message: "Demasiadas filas de una vez (máximo 200)" } }];
}

const incompletas = rows.filter(
  (r) => !r || !r.id || !r.house_code || !r.check_in || !r.check_out
);
if (incompletas.length) {
  return [{ json: { ok: false, message: incompletas.length + " filas sin id, casa o fechas" } }];
}

// Este workflow agrega sin mirar lo que ya hay. Reenviar la misma fila —por un
// reintento, o por creerla perdida cuando ya estaba— la duplicaba en silencio,
// y el panel la contaba dos veces. Pasó con una estadía de $520.000.
const yaEstan = new Set(
  ($items("Leer la planilla") || [])
    .map((i) => String(i?.json?.id || "").trim())
    .filter(Boolean)
);

const repetidas = rows.map((r) => String(r.id).trim()).filter((id) => yaEstan.has(id));
if (repetidas.length) {
  return [{ json: {
    ok: false,
    message: "Estos ids ya están cargados: " + repetidas.slice(0, 5).join(", ") +
             (repetidas.length > 5 ? " y " + (repetidas.length - 5) + " más" : "") +
             ". No se escribió nada.",
  } }];
}

// Tampoco puede venir el mismo id dos veces en el mismo pedido.
const vistos = new Set();
const dobles = rows.map((r) => String(r.id).trim()).filter((id) => vistos.has(id) || !vistos.add(id));
if (dobles.length) {
  return [{ json: { ok: false, message: "El pedido trae ids repetidos: " + [...new Set(dobles)].join(", ") } }];
}

return [{ json: { ok: true, total: rows.length } }];`,
    },
  },
  output: [{ ok: true, total: 91 }],
});

const siEsValido = ifElse({
  version: 2.3,
  config: {
    name: 'If',
    position: [448, 192],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [
          {
            leftValue: '={{ $json.ok }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      looseTypeValidation: true,
      options: {},
    },
  },
  output: [{ ok: true, total: 91 }],
});

const expandir = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'expandir filas',
    position: [672, 96],
    parameters: {
      jsCode: `const wh = $items("Webhook")?.[0]?.json || {};
const body = wh.body || wh;
const rows = Array.isArray(body.rows) ? body.rows : [];

// Una fila de la planilla por cada estadía del Excel.
return rows.map((r) => ({ json: r }));`,
    },
  },
  output: [
    {
      id: 'XL-2526-LC1-2025-12-01',
      status: 'CONFIRMED',
      source: 'excel',
      house_code: 'LC1',
      check_in: '2025-12-01',
      check_out: '2025-12-03',
      guest_name: 'Ejemplo',
    },
  ],
});

const escribir = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Agregar a la planilla',
    position: [896, 96],
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: {
        __rl: true,
        mode: 'list',
        value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE',
        cachedResultName: 'Las Cañas - Reservas',
      },
      sheetName: {
        __rl: true,
        mode: 'list',
        value: 'gid=0',
        cachedResultName: 'reservas',
      },
      columns: {
        mappingMode: 'autoMapInputData',
        value: {},
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'house_code', displayName: 'house_code', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'check_in', displayName: 'check_in', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'check_out', displayName: 'check_out', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'guest_name', displayName: 'guest_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'dni', displayName: 'dni', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'guests', displayName: 'guests', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'payment_method', displayName: 'payment_method', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'approved_at', displayName: 'approved_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'importe', displayName: 'importe', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'anticipo', displayName: 'anticipo', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'facturado', displayName: 'facturado', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'cotizacion_usd', displayName: 'cotizacion_usd', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
      },
      options: {
        cellFormat: 'RAW',
        handlingExtraData: 'ignoreIt',
        useAppend: true,
      },
    },
    credentials: {
      googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' },
    },
  },
  output: [{ id: 'XL-2526-LC1-2025-12-01', check_in: '2025-12-01' }],
});

const resumen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'resumen',
    position: [1120, 96],
    parameters: {
      jsCode: `const pedido = $items("validar pedido")[0]?.json || {};
const escritas = $input.all().length;

return [{
  json: {
    ok: escritas === (pedido.total || 0),
    pedidas: pedido.total || 0,
    escritas,
  }
}];`,
    },
  },
  output: [{ ok: true, pedidas: 91, escritas: 91 }],
});

const responder = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    position: [1344, 96],
    parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} },
  },
  output: [{ ok: true }],
});

const rechazar = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Rechazado',
    position: [672, 288],
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json }}',
      options: { responseCode: 400 },
    },
  },
  output: [{ ok: false }],
});

export default workflow('lc-importar-excel', 'importar-excel')
  .add(webhook)
  .to(leerTodo)
  .to(validar)
  .to(siEsValido.onTrue(expandir.to(escribir).to(resumen).to(responder)).onFalse(rechazar));
