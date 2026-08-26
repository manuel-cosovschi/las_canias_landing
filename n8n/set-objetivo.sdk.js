// Workflow `set-objetivo` de n8n (copia versionada).
//
// Fija el objetivo de facturación de una temporada en la data table
// `objetivos_temporada`. Lo llama el panel vía la función set-season-goal
// de Netlify.
//
// Es un upsert por `temporada`: guardar dos veces el mismo año pisa la fila en
// vez de dejar dos. Sin eso, `get-objetivos` devolvería la última que leyera y
// el objetivo cambiaría solo de un refresh a otro.
//
// Un objetivo en 0 es válido a propósito: es cómo se borra. Se escribe igual y
// `get-objetivos` lo descarta al armar la respuesta.
//
// El valor real del secret está en el nodo de n8n, no acá.

import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const webhookSetObjetivo = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { httpMethod: 'POST', path: 'set-objetivo', responseMode: 'responseNode', options: {} },
    position: [0, 96],
  },
  output: [{ headers: { 'x-lc-secret': 'secreto' }, body: { temporada: '2025', objetivo: 80000000 } }],
});

const validar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'validar',
    parameters: {
      jsCode:
        'const wh = $items("Webhook")?.[0]?.json || {};\n' +
        'const headers = wh.headers || {};\n' +
        '\n' +
        'const secret =\n' +
        '  headers["x-lc-secret"] ||\n' +
        '  headers["X-Lc-Secret"] ||\n' +
        '  headers["X-LC-SECRET"] ||\n' +
        '  "";\n' +
        '\n' +
        'const EXPECTED = "***";\n' +
        'if (secret !== EXPECTED) {\n' +
        '  return [{ json: { ok: false, code: 401, message: "Unauthorized (secret inválido)" } }];\n' +
        '}\n' +
        '\n' +
        'const body = wh.body || {};\n' +
        'const temporada = String(body.temporada ?? "").trim();\n' +
        'const objetivo = Number(body.objetivo);\n' +
        '\n' +
        '// La temporada se identifica por su año de arranque: la 25-26 es "2025".\n' +
        'if (!/^\\d{4}$/.test(temporada)) {\n' +
        '  return [{ json: { ok: false, code: 400, message: "temporada tiene que ser el año de inicio, por ejemplo 2025" } }];\n' +
        '}\n' +
        'if (!Number.isFinite(objetivo) || objetivo < 0) {\n' +
        '  return [{ json: { ok: false, code: 400, message: "objetivo tiene que ser un número mayor o igual a 0" } }];\n' +
        '}\n' +
        '\n' +
        '// 0 significa "sin objetivo": se guarda igual y la lectura lo descarta.\n' +
        'return [{ json: { ok: true, temporada, objetivo } }];',
    },
    position: [224, 96],
  },
  output: [{ ok: true, temporada: '2025', objetivo: 80000000 }],
});

const esValido = ifElse({
  version: 2.3,
  config: {
    name: 'If',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [
          { id: 'ok-true', leftValue: expr('{{ $json.ok }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
        ],
        combinator: 'and',
      },
      looseTypeValidation: true,
      options: {},
    },
    position: [448, 96],
  },
});

const guardarObjetivo = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Guardar objetivo',
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: { __rl: true, mode: 'id', value: 'KiVTfTjE0rOCR1zC', cachedResultName: 'objetivos_temporada' },
      matchType: 'allConditions',
      filters: {
        conditions: [
          { keyName: 'temporada', condition: 'eq', keyValue: expr('{{ $json.temporada }}') },
        ],
      },
      columns: {
        mappingMode: 'defineBelow',
        matchingColumns: ['temporada'],
        value: { temporada: expr('{{ $json.temporada }}'), objetivo: expr('{{ $json.objetivo }}') },
        schema: [
          { id: 'temporada', displayName: 'temporada', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'objetivo', displayName: 'objetivo', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    position: [672, 0],
  },
  output: [{ id: 1, temporada: '2025', objetivo: 80000000 }],
});

// El upsert devuelve {id, createdAt, updatedAt} y se lleva puestos temporada e
// importe, así que la respuesta se arma leyendo de nuevo lo que validamos.
const armarRespuesta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'armar respuesta',
    parameters: {
      jsCode:
        'const v = $items("validar")?.[0]?.json || {};\n' +
        'return [{ json: { ok: true, temporada: v.temporada, objetivo: v.objetivo } }];',
    },
    position: [896, 0],
  },
  output: [{ ok: true, temporada: '2025', objetivo: 80000000 }],
});

const responderOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: { responseCode: 200 } },
    position: [1120, 0],
  },
  output: [{ ok: true }],
});

// 401 si el secret no va, 400 si el dueño mandó algo mal: el código sale del
// propio rechazo para que Netlify pueda distinguirlos.
const responderRechazo = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook1',
    parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: { responseCode: expr('{{ $json.code || 400 }}') } },
    position: [672, 192],
  },
  output: [{ ok: false }],
});

export default workflow('set-objetivo', 'set-objetivo')
  .add(webhookSetObjetivo)
  .to(validar)
  .to(esValido
    .onTrue(guardarObjetivo.to(armarRespuesta).to(responderOk))
    .onFalse(responderRechazo));
