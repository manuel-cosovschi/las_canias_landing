// Workflow `get-objetivos` de n8n (copia versionada).
//
// Devuelve el objetivo de facturación de cada temporada, guardado en la data
// table `objetivos_temporada`. Lo consume el panel vía la función
// season-goals de Netlify.
//
// La temporada se identifica por su año de arranque: la 25-26 es "2025", igual
// que en `temporadaDe()` del panel.
//
// Un objetivo en 0 no se devuelve: 0 es cómo se borra, así que la respuesta
// sólo trae las temporadas que realmente tienen uno puesto.
//
// El valor real del secret está en el nodo de n8n, no acá.

import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const webhookObjetivos = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { httpMethod: 'GET', path: 'get-objetivos', responseMode: 'responseNode', options: {} },
    position: [0, 96],
  },
  output: [{ headers: { 'x-lc-secret': 'secreto' } }],
});

const validarSecret = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'validar secret',
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
        '  return [{ json: { ok: false, message: "Unauthorized (secret inválido)" } }];\n' +
        '}\n' +
        '\n' +
        'return [{ json: { ok: true } }];',
    },
    position: [224, 96],
  },
  output: [{ ok: true }],
});

const secretOk = ifElse({
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

const leerObjetivos = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer objetivos',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'KiVTfTjE0rOCR1zC', cachedResultName: 'objetivos_temporada' },
      returnAll: true,
    },
    // Con la tabla vacía tiene que seguir contestando {} en vez de cortarse.
    alwaysOutputData: true,
    position: [672, 0],
  },
  output: [{ temporada: '2025', objetivo: 80000000 }],
});

const armarRespuesta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'armar respuesta',
    parameters: {
      jsCode:
        'const filas = ($items("Leer objetivos") || [])\n' +
        '  .map(i => i?.json || {})\n' +
        '  .filter(r => r && r.temporada);\n' +
        '\n' +
        'const goals = {};\n' +
        'for (const r of filas) {\n' +
        '  const monto = Number(r.objetivo) || 0;\n' +
        '  if (monto > 0) goals[String(r.temporada).trim()] = monto;\n' +
        '}\n' +
        '\n' +
        'return [{ json: { ok: true, goals } }];',
    },
    position: [896, 0],
  },
  output: [{ ok: true, goals: { 2025: 80000000 } }],
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

const responderNoAutorizado = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook1',
    parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: { responseCode: 401 } },
    position: [672, 192],
  },
  output: [{ ok: false }],
});

export default workflow('get-objetivos', 'get-objetivos')
  .add(webhookObjetivos)
  .to(validarSecret)
  .to(secretOk
    .onTrue(leerObjetivos.to(armarRespuesta).to(responderOk))
    .onFalse(responderNoAutorizado));
