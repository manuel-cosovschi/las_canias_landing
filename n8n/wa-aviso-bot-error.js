// Copia versionada del nodo `Evaluar si hay que avisar` del workflow
// `LC - Aviso: el bot está contestando con error` de n8n (id ALxz0FxmZO3Ax416).
//
// **Si cambiás esto, cambialo también en n8n**, y al revés. Debajo de esta
// cabecera el archivo es idéntico al nodo publicado.
//
// Las pruebas están en wa-aviso-bot-error.test.js, al lado. Corren con node
// pelado y leen este archivo, así que prueban el código que se publica.

// Decide si el bot esta roto y hay que avisar.
//
// Cuando el nodo ChatGPT Brain falla, Canita contesta un texto de disculpa y lo
// registra en wa_conversaciones con intent="error". Para n8n eso es una
// ejecucion EXITOSA, asi que una caida no se ve en ningun lado: el 08/10/2026
// habia 2736 ejecuciones y CERO errores, con el bot roto.
//
// Entre el 30/09 y el 08/10 de 2026 estuvo roto 8 dias por una cuenta de OpenAI
// dada de baja. 18 clientes reales se quedaron sin respuesta, varios con fechas
// de temporada alta. Nadie se dio cuenta porque 'Hola' siempre funciono: lo
// contesta el nodo Fast Rules, que no toca OpenAI.
//
// Copia versionada en n8n/wa-aviso-bot-error.js del repo.

// ---- umbrales (tocar aca si avisa de mas o de menos) ----
var ERRORES_PARA_RAFAGA = 3;   // en la ultima hora, avisa al toque
var ERRORES_PARA_DIARIO = 3;   // en 24 horas, para el chequeo de la manana
var HORA_DEL_CHEQUEO_ARG = 9;  // hora de Argentina del chequeo diario

var h = function (n) { return n * 3600000; };
var ahora = Date.now();

var filas = $input.all()
  .map(function (i) { return i.json; })
  .filter(function (r) {
    return r && r.createdAt && Number.isFinite(Date.parse(r.createdAt));
  });

var edad = function (r) { return ahora - Date.parse(r.createdAt); };
var ultimaHora = filas.filter(function (r) { return edad(r) <= h(1); });
var ultimas24 = filas.filter(function (r) { return edad(r) <= h(24); });

// Hora de Argentina sin depender de la zona del server (UTC-3).
var horaArg = new Date(ahora - h(3)).getUTCHours();

var rafaga = ultimaHora.length >= ERRORES_PARA_RAFAGA;
var diario = horaArg === HORA_DEL_CHEQUEO_ARG && ultimas24.length >= ERRORES_PARA_DIARIO;

if (!rafaga && !diario) {
  return [{
    json: {
      alertar: false,
      ultima_hora: ultimaHora.length,
      ultimas_24h: ultimas24.length,
    },
  }];
}

var motivo = rafaga
  ? ultimaHora.length + ' respuestas con error en la ultima hora'
  : ultimas24.length + ' respuestas con error en las ultimas 24 horas';

// El texto lo escribio un cliente: si trae < o & hay que escaparlo, o rompe el
// mail (y seria una inyeccion de html en la casilla del dueno).
var esc = function (s) {
  return String(s == null ? '' : s)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;');
};

var fmt = function (iso) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
};

var td = 'padding:6px 10px;border-bottom:1px solid #f0eadc;';
var tdNw = td + 'white-space:nowrap;';

var aMostrar = ultimas24.slice()
  .sort(function (a, b) { return Date.parse(b.createdAt) - Date.parse(a.createdAt); })
  .slice(0, 12);

var celda = function (estilo, texto) {
  return '<td style=' + String.fromCharCode(34) + estilo + String.fromCharCode(34) + '>' + esc(texto) + '</td>';
};

var filas_html = aMostrar.map(function (r) {
  return '<tr>' +
    celda(tdNw, fmt(r.createdAt)) +
    celda(td, r.nombre || '-') +
    celda(tdNw, r.wa_id || '-') +
    celda(td, r.entrante || '-') +
    '</tr>';
}).join('');

var resto = ultimas24.length - aMostrar.length;

return [{
  json: {
    alertar: true,
    motivo: motivo,
    ultima_hora: ultimaHora.length,
    ultimas_24h: ultimas24.length,
    filas_html: filas_html,
    resto_texto: resto > 0 ? ('y ' + resto + ' mas en las ultimas 24 horas.') : '',
  },
}];
