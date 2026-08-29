// Workflow `set-reservation-guest` de n8n (copia versionada).
//
// Carga o corrige los datos del huésped de una fila que ya existe: nombre,
// teléfono, mail, DNI y notas. Lo llama el panel desde el calendario, vía la
// función set-reservation-guest de Netlify.
//
// Existe porque había un agujero: admin-update-reservation sólo cambia el
// estado y set-reservation-payment sólo toca la plata, así que un bloqueo
// creado sin datos se quedaba sin nombre para siempre.
//
// Es el hermano de set-reservation-payment y sigue el mismo camino: valida el
// secret, busca la fila por id, fusiona sólo los campos que llegaron sobre lo
// que ya estaba guardado, y recién ahí escribe. Esa fusión es lo que permite
// guardar un teléfono sin borrar el nombre.
//
// El valor real del secret está en el nodo de n8n, no acá.

import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    position: [0, 192],
    parameters: { httpMethod: 'POST', path: 'set-reservation-guest', responseMode: 'responseNode', options: {} },
  },
  output: [{ body: { id: 'X', guest_name: 'Ana Perez', phone: '2236000000' }, headers: {} }],
});

const validar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'validar secret + id',
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

const id = String(body.id || "").trim();
if (!id) {
  return [{ json: { ok: false, message: "Falta campo: id" } }];
}

// Solo viajan los campos que el panel realmente edito; el resto se deja como
// esta para no pisar lo que ya estaba cargado. Mismo criterio que
// set-reservation-payment, que es el hermano de este flujo.
const cambios = {};
for (const campo of ["guest_name", "phone", "email", "dni", "notes"]) {
  if (body[campo] !== undefined) cambios[campo] = String(body[campo] ?? "").trim();
}

if (!Object.keys(cambios).length) {
  return [{ json: { ok: false, message: "No hay nada para guardar" } }];
}

return [{ json: { ok: true, id, cambios } }];`,
    },
  },
  output: [{ ok: true, id: 'X', cambios: { guest_name: 'Ana Perez' } }],
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

const buscar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Buscar reserva',
    position: [672, 96],
    parameters: {
      documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', cachedResultName: 'Las Canas - Reservas' },
      sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'reservas' },
      filtersUI: { values: [{ lookupColumn: 'id', lookupValue: '={{ $json.id }}' }] },
      options: {},
    },
    alwaysOutputData: true,
    credentials: { googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' } },
  },
  output: [{ id: 'X', guest_name: '', phone: '', rowNumber: 2 }],
});

const combinar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'combinar con lo guardado',
    position: [896, 96],
    parameters: {
      jsCode: `const pedido = $items("validar secret + id")[0]?.json || {};
const cambios = pedido.cambios || {};

// Con Always Output Data puede venir un item vacio si el id no existe: la
// fila de verdad es la que trae numero de fila.
const fila = ($items("Buscar reserva") || [])
  .map(i => i?.json || {})
  .find(r => r.rowNumber || r.row_number) || null;

if (!fila) {
  return [{ json: { ok: false, found: false, message: "Reserva no encontrada", id: pedido.id } }];
}

const valor = (campo) => (cambios[campo] !== undefined ? cambios[campo] : (fila[campo] ?? ""));

return [{
  json: {
    ok: true,
    found: true,
    id: fila.id,
    guest_name: valor("guest_name"),
    phone: valor("phone"),
    email: valor("email"),
    dni: valor("dni"),
    notes: valor("notes"),
  }
}];`,
    },
  },
  output: [{ ok: true, found: true, id: 'X', guest_name: 'Ana Perez' }],
});

const siEncontrada = ifElse({
  version: 2.3,
  config: {
    name: 'If encontrada',
    position: [1120, 96],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [{ leftValue: '={{ $json.found }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
      options: {},
    },
  },
  output: [{ found: true }],
});

const guardar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Guardar datos',
    position: [1344, 0],
    parameters: {
      operation: 'update',
      documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', cachedResultName: 'Las Canas - Reservas' },
      sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'reservas' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          id: '={{ $json.id }}',
          guest_name: '={{ $json.guest_name }}',
          phone: '={{ $json.phone }}',
          email: '={{ $json.email }}',
          dni: '={{ $json.dni }}',
          notes: '={{ $json.notes }}',
        },
        matchingColumns: ['id'],
        schema: [
          { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'guest_name', displayName: 'guest_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'dni', displayName: 'dni', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      // RAW para que un DNI o un teléfono con ceros adelante no se los coma
      // Google Sheets convirtiéndolos a número.
      options: { cellFormat: 'RAW' },
    },
    credentials: { googleSheetsOAuth2Api: { id: 'txcnDFFyw26weWa8', name: 'Google Sheets account' } },
  },
  output: [{ id: 'X', guest_name: 'Ana Perez' }],
});

const responderOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    position: [1568, 0],
    parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} },
  },
  output: [{ ok: true }],
});

const noEncontrada = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'No encontrada',
    position: [1344, 192],
    parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: { responseCode: 404 } },
  },
  output: [{ ok: false }],
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

export default workflow('set-reservation-guest', 'set-reservation-guest')
  .add(webhook)
  .to(validar)
  .to(siAutorizado
    .onTrue(buscar.to(combinar).to(siEncontrada
      .onTrue(guardar.to(responderOk))
      .onFalse(noEncontrada)))
    .onFalse(noAutorizado));
