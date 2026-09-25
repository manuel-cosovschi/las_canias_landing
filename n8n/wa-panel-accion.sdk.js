// Workflow `wa-panel-accion` de n8n (copia versionada).
//
// Lo que el panel usa para intervenir en una conversación de WhatsApp. Recibe
// `{ accion, wa_id, texto }` por POST y acepta tres acciones:
//
// - `pausar`    → Cañita deja de responderle a ese contacto
// - `reanudar`  → Cañita vuelve a atenderlo
// - `responder` → manda un mensaje como Las Cañas y lo guarda en la charla
//
// La pausa se guarda en `wa_pausados`, que es un registro *append-only*: cada
// pausa o reanudación agrega una fila y gana la más reciente. Por eso acá sólo
// hay inserts y ningún update — queda el historial de cuándo se tomó y cuándo se
// devolvió cada conversación, y es exactamente lo que lee el bot.
//
// El envío va con `onError: continueErrorOutput` a propósito: WhatsApp rechaza
// el texto libre pasadas 24 hs del último mensaje del huésped, y el panel tiene
// que poder explicar ese motivo en vez de recibir un 500 opaco.
//
// El valor real del secret está en el nodo de n8n, no acá.

import { workflow, node, trigger, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const webhookAccion = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { httpMethod: 'POST', path: 'wa-panel-accion', responseMode: 'responseNode', options: {} },
    position: [0, 96],
  },
  output: [{ headers: { 'x-lc-secret': 'secreto' }, body: { accion: 'pausar', wa_id: '549…' } }],
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
        'const body = wh.body || {};\n' +
        '\n' +
        'const secret =\n' +
        '  headers["x-lc-secret"] ||\n' +
        '  headers["X-Lc-Secret"] ||\n' +
        '  headers["X-LC-SECRET"] ||\n' +
        '  "";\n' +
        '\n' +
        'const EXPECTED = "***";\n' +
        'if (secret !== EXPECTED) {\n' +
        '  return [{ json: { ok: false, code: 401, message: "Unauthorized (secret invalido)" } }];\n' +
        '}\n' +
        '\n' +
        'const accion = String(body.accion || "").trim().toLowerCase();\n' +
        'const wa_id = String(body.wa_id || "").trim().replace(/[^0-9]/g, "");\n' +
        'const texto = String(body.texto || "").trim();\n' +
        '\n' +
        'if (!wa_id) return [{ json: { ok: false, code: 400, message: "Falta el numero de contacto" } }];\n' +
        'if (["pausar", "reanudar", "responder"].indexOf(accion) === -1) {\n' +
        '  return [{ json: { ok: false, code: 400, message: "Accion invalida" } }];\n' +
        '}\n' +
        'if (accion === "responder" && !texto) {\n' +
        '  return [{ json: { ok: false, code: 400, message: "Falta el texto del mensaje" } }];\n' +
        '}\n' +
        'if (texto.length > 4000) {\n' +
        '  return [{ json: { ok: false, code: 400, message: "El mensaje es demasiado largo" } }];\n' +
        '}\n' +
        '\n' +
        'return [{ json: { ok: true, accion, wa_id, texto } }];',
    },
    position: [224, 96],
  },
  output: [{ ok: true, accion: 'pausar', wa_id: '549…', texto: '' }],
});

const okValidacion = ifElse({
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

const unaRegla = (valor) => ({
  outputKey: valor,
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
    conditions: [{ leftValue: expr('{{ $json.accion }}'), operator: { type: 'string', operation: 'equals' }, rightValue: valor }],
    combinator: 'and',
  },
});

const ruteo = switchCase({
  version: 3.2,
  config: {
    name: 'Ruteo',
    parameters: {
      rules: { values: [unaRegla('pausar'), unaRegla('reanudar'), unaRegla('responder')] },
      options: {},
    },
    position: [672, 0],
  },
});

// Pausar y reanudar son la misma inserción con distinto valor: el bot lee la
// fila más nueva de cada contacto, así que alcanza con agregar una.
const filaDePausa = (nombre, pausado, nota, y) => node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: nombre,
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'e4TudWxcBd5PK0Gt', cachedResultName: 'wa_pausados' },
      columns: {
        mappingMode: 'defineBelow',
        value: { wa_id: expr('{{ $json.wa_id }}'), pausado, nota },
      },
    },
    position: [896, y],
  },
});

const guardarPausa = filaDePausa('Guardar pausa', true, 'Pausado desde el panel', -192);
const guardarReanudacion = filaDePausa('Guardar reanudacion', false, 'Reanudado desde el panel', 0);

const enviarWhatsApp = node({
  type: 'n8n-nodes-base.whatsApp',
  version: 1.1,
  config: {
    name: 'Enviar WhatsApp',
    parameters: {
      operation: 'send',
      phoneNumberId: '961129697092265',
      recipientPhoneNumber: expr('{{ $json.wa_id }}'),
      textBody: expr('{{ $json.texto }}'),
      additionalFields: {},
    },
    credentials: { whatsAppApi: { id: 'DIoWlEwww0o0r47z', name: 'WhatsApp account' } },
    onError: 'continueErrorOutput',
    position: [896, 192],
  },
});

// Se registra con `entrante` vacío e `intent` "manual": así la transcripción del
// panel muestra que ese mensaje lo escribió el dueño y no Cañita.
const registrarManual = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Registrar respuesta manual',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'JzGJKMd0t9u0Wo4p', cachedResultName: 'wa_conversaciones' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          wa_id: expr('{{ $node["validar"].json["wa_id"] }}'),
          nombre: '',
          entrante: '',
          saliente: expr('{{ $node["validar"].json["texto"] }}'),
          intent: 'manual',
        },
      },
    },
    position: [1120, 192],
  },
});

const responderOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond OK',
    parameters: { respondWith: 'json', responseBody: '={{ { ok: true, accion: $node["validar"].json["accion"] } }}', options: { responseCode: 200 } },
    position: [1344, 0],
  },
  output: [{ ok: true, accion: 'pausar' }],
});

const responderErrorEnvio = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond error envio',
    parameters: {
      respondWith: 'json',
      responseBody:
        "={{ { ok: false, ventana: true, message: 'WhatsApp no dejó enviar el mensaje. Suele pasar cuando pasaron más de 24 horas desde el último mensaje del huésped: fuera de esa ventana Meta sólo permite plantillas aprobadas.', detalle: ($json.error && $json.error.message) || null } }}",
      options: { responseCode: 400 },
    },
    position: [1120, 400],
  },
  output: [{ ok: false, ventana: true }],
});

const responderRechazo = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond rechazo',
    parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: { responseCode: '={{ $json.code || 400 }}' } },
    position: [672, 288],
  },
  output: [{ ok: false, code: 401 }],
});

export default workflow('wa-panel-accion', 'wa-panel-accion')
  .add(webhookAccion)
  .to(validar)
  .to(okValidacion
    .onTrue(ruteo
      .onCase(0, guardarPausa.to(responderOk))
      .onCase(1, guardarReanudacion.to(responderOk))
      .onCase(2, enviarWhatsApp.to(registrarManual).to(responderOk)))
    .onFalse(responderRechazo));

// La salida de error de `Enviar WhatsApp` (índice 1) va a `Respond error envio`.
// El SDK sólo cablea la salida principal con .to(), así que esa conexión se
// agrega aparte sobre el workflow ya creado.
export { responderErrorEnvio };
