// Nodo `Build Price Reply` del workflow `WhatsApp Bot – Las Cañas` en n8n
// (copia versionada: el nodo vive en n8n, esto es para poder revisarlo acá).
//
// Workflow: R50ap9XH3jz6viU0 · rama `price` del Intent Router.
// Entra: la respuesta de `Get Prices`, que pega a
//   https://lascaniasmardecobo.com/.netlify/functions/price-periods
// Sale: { reply } — el texto que manda `Rama price/reserve/faq`.
//
// Por qué existe este archivo: el bot cotizaba mal y el motivo no se podía
// encontrar buscando en el repo, porque el nodo está en n8n. Apuntaba a
// `public-prices`, que devuelve una lista suelta de precios sin fechas, así que
// contestaba lo mismo para agosto que para el 2 de enero. A una consulta por
// diez noches de enero le cotizó menos de la mitad de lo que correspondía.
//
// Si cambiás esto, cambialo en n8n: este archivo es la copia, no la fuente.

// Precios por periodo, leidos de la misma tabla que los duenos editan desde el
// panel (precios_periodos, via /.netlify/functions/price-periods).
//
// Antes este nodo pegaba a public-prices, un endpoint viejo que devuelve una
// lista suelta de precios sin fechas. Por eso cotizaba lo mismo para agosto que
// para el 2 de enero, y para enero cotizaba menos de la mitad de lo que
// corresponde.
//
// La logica es la misma que usa reservar.html, a proposito: "to" es INCLUSIVO
// (es la ultima noche que se cobra a ese precio), cada noche se cobra segun su
// propia fecha, y una noche sin periodo cargado NO se cotiza en vez de
// inventarle un precio: cobrar de menos sin que nadie se entere es peor que
// pedirle a la persona que espere la confirmacion.

const CASAS = ["LC1", "LC2", "LC3", "LC4", "LC5"];
const NOMBRE = {
  LC1: "Las Cañas 1",
  LC2: "Las Cañas 2",
  LC3: "Las Cañas 3",
  LC4: "Las Cañas 4",
  LC5: "Las Cañas 5",
};
const WA_HUMANO =
  "https://api.whatsapp.com/send/?phone=5492236882986&text&type=phone_number&app_absent=0&wame_ctl=1";

function normalizar(p) {
  if (!p || typeof p !== "object") return null;
  const from = String(p.from || "").slice(0, 10);
  const to = String(p.to || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  if (from > to) return null;

  const precios = {};
  for (const c of CASAS) {
    const n = Number((p.prices || {})[c]);
    if (!Number.isFinite(n) || n <= 0) return null;
    precios[c] = n;
  }
  return { from, to, label: String(p.label || ""), precios };
}

const crudos = Array.isArray($json.periods) ? $json.periods : [];
const periodos = crudos.map(normalizar).filter(Boolean);
periodos.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

// Sin periodos legibles no se inventa un precio: se deriva.
if (!periodos.length) {
  return [
    {
      json: {
        reply:
          "Uy, justo no puedo ver los valores en este momento 🙏 Te paso nuestro WhatsApp así te los pasamos a mano:\n\n" +
          WA_HUMANO,
      },
    },
  ];
}

// De donde salen las fechas. Hay dos fuentes y el orden importa:
//
// - `Normalize Brain Output` trae lo que el cerebro acaba de extraer DEL MENSAJE
//   que la persona escribio recien.
// - `Load State` trae la memoria guardada, que es lo que se sabia ANTES de este
//   mensaje.
//
// Este nodo leia solo la memoria, asi que en el primer mensaje de una charla
// estaba siempre vacia: a quien escribia "que precio tiene Las Cañas 3 del 2 al
// 12 de enero?" le contestaba con el periodo vigente, ignorando enero. El
// cerebro habia entendido bien —guardaba dates 2027-01-02 a 2027-01-12 y LC3—,
// pero esa extraccion se leia un paso mas tarde del que hacia falta.
//
// Primero lo del mensaje actual; la memoria queda de respaldo para cuando la
// persona ya venia hablando ("dale, pasame valores" despues de dar las fechas).
let recien = {};
try {
  recien = $("Normalize Brain Output").first().json || {};
} catch (e) {
  recien = {};
}

let guardado = {};
try {
  guardado = ($("Load State").first().json || {}).state || {};
} catch (e) {
  guardado = {};
}

const esYMD = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const fechasValidas = (v) => Array.isArray(v) && v.length === 2 && esYMD(v[0]) && esYMD(v[1]);

const fechas = fechasValidas(recien.dates)
  ? recien.dates
  : fechasValidas(guardado.dates)
  ? guardado.dates
  : [];

const preferida = String(recien.house_preference || guardado.house_preference || "").toUpperCase();
const casaPref = CASAS.indexOf(preferida) !== -1 ? preferida : null;

const pesos = (n) => "$" + Number(n).toLocaleString("es-AR");
const dia = (ymd) => ymd.slice(8, 10) + "/" + ymd.slice(5, 7);

function sumarDias(ymd, n) {
  const partes = ymd.split("-").map(Number);
  const f = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
}

function contarNoches(ci, co) {
  const a = ci.split("-").map(Number);
  const b = co.split("-").map(Number);
  const ms = Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2]);
  return Math.round(ms / 86400000);
}

function precioDeNoche(ymd, casa) {
  for (const p of periodos) {
    if (ymd >= p.from && ymd <= p.to) {
      const v = p.precios[casa];
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

function calcular(ci, co, casa) {
  const noches = contarNoches(ci, co);
  if (!(noches > 0)) return null;

  let total = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < noches; i++) {
    const v = precioDeNoche(sumarDias(ci, i), casa);
    if (v == null) return null; // una sola noche sin tarifa invalida la cotizacion
    total += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { noches, total, senia: Math.round(total * 0.5), min, max };
}

let hoy;
try {
  hoy = $now.toFormat("yyyy-MM-dd");
} catch (e) {
  hoy = new Date().toISOString().slice(0, 10);
}

const tieneFechas = fechas.length === 2;

let reply;

if (tieneFechas) {
  const ci = fechas[0];
  const co = fechas[1];
  const casas = casaPref ? [casaPref] : CASAS;
  const cotizaciones = casas
    .map((c) => ({ casa: c, calc: calcular(ci, co, c) }))
    .filter((x) => x.calc);

  if (!cotizaciones.length) {
    reply =
      "Para esas fechas todavía no tengo la tarifa cargada 🙏 Te paso nuestro WhatsApp así te la confirmamos:\n\n" +
      WA_HUMANO;
  } else {
    const n = cotizaciones[0].calc.noches;
    const encabezado =
      "Para el " + dia(ci) + " al " + dia(co) + " (" + n + (n === 1 ? " noche" : " noches") + "):";

    const lineas = cotizaciones.map(function (x) {
      // Si la estadia cruza periodos, mostrar una sola noche daria a entender
      // que todas valen igual.
      const porNoche =
        x.calc.min === x.calc.max
          ? pesos(x.calc.min)
          : pesos(x.calc.min) + " a " + pesos(x.calc.max);
      return "• " + NOMBRE[x.casa] + ": " + porNoche + " la noche · total " + pesos(x.calc.total);
    });

    const cierre =
      cotizaciones.length === 1
        ? "La seña es la mitad: " + pesos(cotizaciones[0].calc.senia) + ". ¿Te paso el link para reservar?"
        : "¿Querés que te diga cuál les conviene o te paso el link para reservar?";

    reply = "¡Dale! 😊 " + encabezado + "\n\n" + lineas.join("\n") + "\n\n" + cierre;
  }
} else {
  // Sin fechas no se puede dar "el" precio: se muestra el periodo vigente (o el
  // proximo que venga) diciendo a que fechas corresponde, y se pide la fecha.
  const vigente =
    periodos.find((p) => hoy >= p.from && hoy <= p.to) ||
    periodos.find((p) => p.from > hoy) ||
    periodos[periodos.length - 1];

  const lineas = CASAS.map((c) => "• " + NOMBRE[c] + ": " + pesos(vigente.precios[c]));
  const rotulo = vigente.label
    ? vigente.label + " (" + dia(vigente.from) + " al " + dia(vigente.to) + ")"
    : dia(vigente.from) + " al " + dia(vigente.to);

  reply =
    "¡Dale! 😊 Los valores por noche para " +
    rotulo +
    " son:\n\n" +
    lineas.join("\n") +
    "\n\nOjo que cambian según la fecha: decime qué días te interesan y te paso el valor exacto.";
}

return [{ json: { reply } }];
