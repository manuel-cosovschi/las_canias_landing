// Pruebas de wa-aviso-bot-error.js, el nodo que decide si avisar.
//
//     node n8n/wa-aviso-bot-error.test.js
//
// Lee el archivo del nodo del repo y lo corre con el mismo wrapper que usa n8n.
// Incluye el caso del texto del cliente con < y &: si no se escapa, rompe el mail
// del dueno y es una inyeccion de html en su casilla.

const fs = require('fs');
const code = fs.readFileSync(require('path').join(__dirname, 'wa-aviso-bot-error.js'), 'utf8');

if (code.includes('\\')) { console.error('FALLA: el archivo tiene backslashes, el escapeo a JSON deja de ser trivial'); process.exit(1); }
console.log('ok  cero backslashes en el archivo');

new Function('$input', code);
console.log('ok  compila');

const ahora = Date.now();
const f = (m, n, w, t) => ({ json: { createdAt: new Date(ahora - m*60000).toISOString(), nombre: n, wa_id: w, entrante: t, intent: 'error' } });
const correr = (items) => new Function('$input', code)({ all: () => items })[0].json;

let fallos = 0;
const check = (n, ok, extra) => { if (!ok) { fallos++; console.log('FALLA ' + n + (extra ? ' -> ' + extra : '')); } else console.log('ok  ' + n); };

check('sin filas no explota', correr([]).alertar === false);
check('solo errores viejos -> no avisa', correr([f(5000,'V','1','x')]).alertar === false);
check('1 error en la hora -> no avisa', correr([f(10,'A','1','x')]).alertar === false);

const r3 = correr([f(5,'A','1','a'), f(10,'B','2','b'), f(15,'C','3','c')]);
check('3 errores en la hora -> avisa', r3.alertar === true, JSON.stringify(r3.motivo));
check('motivo menciona la ultima hora', /ultima hora/.test(r3.motivo), r3.motivo);
check('arma 3 filas de tabla', (r3.filas_html.match(/<tr>/g) || []).length === 3);

const rEsc = correr([f(5,'Ana <script>','549111','2 & 3 <b>personas</b>'), f(6,'B','2','b'), f(7,'C','3','c')]);
check('escapa < del nombre', /&lt;script&gt;/.test(rEsc.filas_html) && !/<script>/.test(rEsc.filas_html));
check('escapa & del texto', /&amp;/.test(rEsc.filas_html));
check('las comillas del style salen bien', /<td style="padding:6px/.test(rEsc.filas_html), rEsc.filas_html.slice(0,80));

const r13 = correr(Array.from({length: 13}, (_, i) => f(i+1, 'N'+i, String(i), 'msg'+i)));
check('corta en 12 filas', (r13.filas_html.match(/<tr>/g) || []).length === 12);
check('avisa que hay mas', /y 1 mas/.test(r13.resto_texto), r13.resto_texto);

const rOrden = correr([f(50,'VIEJO','1','a'), f(5,'NUEVO','2','b'), f(25,'MEDIO','3','c')]);
check('la mas reciente primero', rOrden.filas_html.indexOf('NUEVO') < rOrden.filas_html.indexOf('MEDIO'));

check('ignora filas sin fecha valida', correr([{json:{nombre:'x'}}, f(5,'A','1','a'), f(6,'B','2','b'), f(7,'C','3','c')]).ultimas_24h === 3);

console.log(fallos ? '\n==== ' + fallos + ' fallan ====' : '\n==== todo ok ====');
process.exit(fallos ? 1 : 0);
