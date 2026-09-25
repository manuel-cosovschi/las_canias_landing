// Workflow `get-wa-conversaciones` de n8n (copia versionada).
//
// Devuelve las conversaciones de Cañita agrupadas por contacto. Lo consume la
// sección *Conversaciones* del panel vía la función wa-conversations de Netlify.
//
// Cruza dos data tables:
//
// - `wa_conversaciones`: una fila por intercambio (lo que escribió el huésped y
//   lo que contestó el bot). La escribe el propio bot al final de cada
//   respuesta, así que arranca vacía y se llena de ahí en adelante.
// - `wa_memory`: el último estado de cada contacto (tema, personas, fechas,
//   casa). Existe desde antes, y es lo que permite mostrar los contactos
//   históricos aunque no tengan la charla guardada.
//
// Los contactos vuelven ordenados por última actividad, con `mensajes` en 0
// cuando sólo hay memoria y no transcripción.
//
// `Leer memoria` va con executeOnce porque cuelga de `Leer conversaciones`: sin
// eso correría una vez por cada fila de conversación y multiplicaría la lectura.
//
// El valor real del secret está en el nodo de n8n, no acá.

import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const webhookConversaciones = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { httpMethod: 'GET', path: 'get-wa-conversaciones', responseMode: 'responseNode', options: {} },
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

const leerConversaciones = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer conversaciones',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'JzGJKMd0t9u0Wo4p', cachedResultName: 'wa_conversaciones' },
      returnAll: true,
    },
    // Con la tabla vacía tiene que seguir contestando la lista de contactos que
    // sale de wa_memory, en vez de cortarse.
    alwaysOutputData: true,
    position: [672, 0],
  },
  output: [{ wa_id: '549…', entrante: 'hola, tienen wifi?', saliente: 'Sí 😊 …', intent: 'faq' }],
});

const leerMemoria = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer memoria',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'Ge4Q5pmG3XsR9BCQ', cachedResultName: 'wa_memory' },
      returnAll: true,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [896, 0],
  },
  output: [{ wa_id: '549…', state: '{"people":4,"dates":[]}', last_topic: 'availability' }],
});

const armarRespuesta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'armar respuesta',
    parameters: {
      jsCode:
        'const convs = ($items("Leer conversaciones") || []).map(i => (i && i.json) || {}).filter(r => r && r.wa_id);\n' +
        'const mem = ($items("Leer memoria") || []).map(i => (i && i.json) || {}).filter(r => r && r.wa_id);\n' +
        '\n' +
        'const porId = new Map();\n' +
        '\n' +
        'for (const m of mem) {\n' +
        '  const id = String(m.wa_id).trim();\n' +
        '  if (!id) continue;\n' +
        '  let st = {};\n' +
        '  try { st = m.state ? (typeof m.state === "string" ? JSON.parse(m.state) : m.state) : {}; } catch (e) { st = {}; }\n' +
        '  porId.set(id, {\n' +
        '    wa_id: id,\n' +
        '    nombre: "",\n' +
        '    last_topic: m.last_topic || "",\n' +
        '    last_intent: st.last_intent || "",\n' +
        '    personas: st.people || 0,\n' +
        '    fechas: Array.isArray(st.dates) ? st.dates : [],\n' +
        '    casa: st.house_preference || null,\n' +
        '    ultima: m.updatedAt || m.createdAt || null,\n' +
        '    conversacion: [],\n' +
        '  });\n' +
        '}\n' +
        '\n' +
        'for (const c of convs) {\n' +
        '  const id = String(c.wa_id).trim();\n' +
        '  if (!id) continue;\n' +
        '  if (!porId.has(id)) {\n' +
        '    porId.set(id, { wa_id: id, nombre: "", last_topic: "", last_intent: "", personas: 0, fechas: [], casa: null, ultima: null, conversacion: [] });\n' +
        '  }\n' +
        '  const it = porId.get(id);\n' +
        '  if (c.nombre && !it.nombre) it.nombre = c.nombre;\n' +
        '  it.conversacion.push({\n' +
        '    entrante: c.entrante || "",\n' +
        '    saliente: c.saliente || "",\n' +
        '    intent: c.intent || "",\n' +
        '    ts: c.createdAt || null,\n' +
        '  });\n' +
        '  if (!it.ultima || (c.createdAt && String(c.createdAt) > String(it.ultima))) it.ultima = c.createdAt;\n' +
        '}\n' +
        '\n' +
        'const contactos = Array.from(porId.values()).map(c => {\n' +
        '  c.conversacion.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));\n' +
        '  c.mensajes = c.conversacion.length;\n' +
        '  return c;\n' +
        '}).sort((a, b) => String(b.ultima || "").localeCompare(String(a.ultima || "")));\n' +
        '\n' +
        'return [{ json: { ok: true, total: contactos.length, contactos } }];',
    },
    position: [1120, 0],
  },
  output: [{ ok: true, total: 230, contactos: [] }],
});

const responderOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: { responseCode: 200 } },
    position: [1344, 0],
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

export default workflow('get-wa-conversaciones', 'get-wa-conversaciones')
  .add(webhookConversaciones)
  .to(validarSecret)
  .to(secretOk
    .onTrue(leerConversaciones.to(leerMemoria).to(armarRespuesta).to(responderOk))
    .onFalse(responderNoAutorizado));
