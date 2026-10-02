// Nodo `Preparar Log` del workflow `WhatsApp Bot – Las Cañas` en n8n
// (copia versionada: el nodo vive en n8n, esto es para poder revisarlo acá).
//
// Workflow: R50ap9XH3jz6viU0 · corre después del envío y escribe la fila de
// `wa_conversaciones`, que es lo que el dueño lee en el CRM del panel.
//
// Si cambiás esto, cambialo en n8n: este archivo es la copia, no la fuente.

// Registra el intercambio (lo que dijo el huesped + lo que respondio Canita).
// Corre DESPUES del envio, asi no agrega latencia a la respuesta.
const parse = $('Parse WhatsApp Message').first().json || {};

const corrio = (n) => { try { return $(n).first().json; } catch (e) { return null; } };

// --- Lo que mando el huesped ---
let entrante = (parse.text || '').trim();
if (!entrante && parse.media_type === 'audio') {
  const tr = corrio('Transcribir Audio');
  if (tr && tr.text) entrante = String(tr.text).trim();
}
if (!entrante) entrante = '[' + (parse.media_type || 'mensaje sin texto') + ']';

// --- Nombre del contacto, si Meta lo manda ---
let nombre = '';
try {
  const v = parse.raw.entry[0].changes[0].value;
  nombre = (v.contacts && v.contacts[0] && v.contacts[0].profile && v.contacts[0].profile.name) || '';
} catch (e) { nombre = ''; }

// Las dos ramas automaticas mandan un texto fijo que vive en el nodo de
// WhatsApp, no aca. El log guardaba en su lugar una NOTA de lo que habia
// pasado ("Le pedi que escriba por texto..."), asi que en el CRM el dueno leia
// una frase que el huesped nunca vio, mezclada con la conversacion de verdad.
// Ahora guarda el texto real.
//
// OJO: esto es una copia. Si cambia el mensaje del nodo, hay que cambiarlo
// aca tambien, o el CRM va a mostrar una version vieja.
const TEXTO_NO_TEXTO =
  '¡Hola! 😊 Soy Cañita, del equipo de Las Cañas 🌊\n' +
  '\n' +
  'Por ahora te leo mejor si me escribís por *texto* 🙏 (todavía no puedo escuchar audios ni ver imágenes).\n' +
  '\n' +
  'Contame *fechas*, *cuántas personas* y qué querés saber —disponibilidad, precios o reservar— y te ayudo al toque.\n' +
  '\n' +
  'Si preferís hablar con una persona del equipo, escribinos acá 👇\n' +
  'https://api.whatsapp.com/send/?phone=5492236882986';

const TEXTO_FALLBACK =
  'Uy, ¡perdón! Se me complicó procesar tu mensaje. ¿Me lo escribís de nuevo? ' +
  'Y si preferís, te paso con una persona del equipo: ' +
  'https://api.whatsapp.com/send/?phone=5492236882986';

// --- Lo que respondio el bot: se detecta que rama fue la que envio ---
const nb = corrio('Normalize Brain Output');
const ba = corrio('Build Availability Reply');
const bp = corrio('Build Price Reply');

let intent = (nb && nb.intent) || '';
let saliente = '';

if (ba && ba.reply) { saliente = ba.reply; intent = intent || 'availability'; }
else if (bp && bp.reply) { saliente = bp.reply; intent = intent || 'price'; }
else if (nb && nb.reply) { saliente = nb.reply; }
else if (corrio('Rama no-texto (auto)')) {
  saliente = TEXTO_NO_TEXTO;
  intent = intent || 'no_texto';
} else if (corrio('Rama IA fallback')) {
  saliente = TEXTO_FALLBACK;
  intent = intent || 'error';
}

return [{
  json: {
    wa_id: parse.from || '',
    nombre: nombre,
    entrante: entrante,
    saliente: saliente,
    intent: intent,
  },
}];
