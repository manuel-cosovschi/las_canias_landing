// netlify/functions/_documento.js
//
// Arma el documento de reserva confirmada que se le manda al huésped cuando el
// dueño confirma la transferencia desde el panel. Reemplaza el Word que se
// mandaba a mano: mismo contenido legal, pero con los colores de Las Cañas y
// completado con los datos de esa reserva.
//
// Devuelve HTML con todo el CSS embebido y sin imágenes externas, porque los
// clientes de mail bloquean hojas de estilo remotas y muchos bloquean también
// las imágenes.

const CASAS = {
  LC1: { nombre: "Las Cañas 1", unidad: "1" },
  LC2: { nombre: "Las Cañas 2", unidad: "2" },
  LC3: { nombre: "Las Cañas 3", unidad: "3" },
  LC4: { nombre: "Las Cañas 4", unidad: "4" },
  LC5: { nombre: "Las Cañas 5", unidad: "5" },
};

const DIRECCION = "Santa Rosa 1030, Mar de Cobo, Partido de Mar Chiquita, Provincia de Buenos Aires";

const PROPIETARIA = { nombre: "Ana Carla Fernandez", dni: "23887759" };

const CONDICIONES = [
  "Las unidades son habitables y están equipadas para la cantidad de personas de esta reserva: 1 toallón por huésped, acolchados, frazadas y almohadas.",
  "Los huéspedes traen sus propias sábanas.",
  "No se permiten visitas.",
  "No se permiten parlantes en los parques.",
  "Priorizamos el descanso de todos los huéspedes: rogamos mantener el ámbito tranquilo, sin ruidos molestos en el espacio común central.",
  "La unidad se entrega en perfecto estado de conservación y limpieza, y se devuelve en las mismas condiciones. Si no fuera posible, está a disposición un servicio de limpieza con cargo adicional.",
  "Dentro del equipamiento podemos proveer dos reposeras de playa en buen estado. Es opción del inquilino usarlas o no, pero en caso de rotura deben reponerse, igual que cualquier otro utensilio que se rompa durante la estadía. Si no pudieran reponerlo, pueden abonar el valor de reemplazo.",
  "La unidad dispone de WiFi.",
  "No se permiten mascotas.",
];

// ---------- helpers ----------

function escapar(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ymdADMY(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function pesos(n) {
  return "$ " + Math.round(Number(n) || 0).toLocaleString("es-AR");
}

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis",
  "veintisiete", "veintiocho", "veintinueve"];

const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];

const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menorAMil(n) {
  if (n === 0) return "";
  if (n === 100) return "cien";

  let out = "";
  const c = Math.floor(n / 100);
  const resto = n % 100;

  if (c) out += CENTENAS[c];

  if (resto) {
    if (out) out += " ";
    if (resto < 30) {
      out += UNIDADES[resto];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      out += DECENAS[d] + (u ? " y " + UNIDADES[u] : "");
    }
  }

  return out;
}

// El documento es un comprobante de pago, así que los importes van en números
// y en letras, como en cualquier recibo.
function numeroALetras(n) {
  const entero = Math.round(Number(n) || 0);
  if (entero === 0) return "cero";
  if (entero < 0) return "menos " + numeroALetras(-entero);

  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const resto = entero % 1000;

  const partes = [];

  if (millones === 1) partes.push("un millón");
  else if (millones > 1) partes.push(menorAMil(millones) + " millones");

  if (miles === 1) partes.push("mil");
  else if (miles > 1) partes.push(menorAMil(miles) + " mil");

  if (resto) partes.push(menorAMil(resto));

  return partes.join(" ").replace(/\buno mil\b/g, "un mil").trim();
}

function importeEnLetras(n) {
  return `${numeroALetras(n)} pesos argentinos`;
}

// ---------- cálculo ----------

function precioDeLaNoche(periodos, ymd, casa) {
  for (const p of periodos || []) {
    if (ymd >= p.from && ymd <= p.to) {
      const precio = Number((p.prices || {})[casa]);
      if (Number.isFinite(precio) && precio > 0) return precio;
    }
  }
  return null;
}

function sumarDias(ymd, dias) {
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + dias * 86400000).toISOString().slice(0, 10);
}

// Mismo criterio que reservar.html: se cobra noche por noche según el período
// en que cae cada una, y si alguna quedó sin tarifa no se inventa un total.
function calcularEstadia(periodos, casa, checkin, checkout, fechaReserva) {
  const ci = String(checkin || "").slice(0, 10);
  const co = String(checkout || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ci) || !/^\d{4}-\d{2}-\d{2}$/.test(co)) return null;

  const noches = Math.round((Date.parse(`${co}T00:00:00Z`) - Date.parse(`${ci}T00:00:00Z`)) / 86400000);
  if (!Number.isFinite(noches) || noches <= 0) return null;

  let total = 0;
  for (let i = 0; i < noches; i++) {
    const precio = precioDeLaNoche(periodos, sumarDias(ci, i), casa);
    if (precio == null) return null;
    total += precio;
  }

  const sena = Math.round(total * 0.5);
  const saldo = total - sena;

  return { noches, total, sena, saldo, cuotas: planDeCuotas(saldo, ci, fechaReserva) };
}

function nochesEntre(ci, co) {
  const ms = Date.parse(`${co}T00:00:00Z`) - Date.parse(`${ci}T00:00:00Z`);
  const noches = Math.round(ms / 86400000);
  return Number.isFinite(noches) && noches > 0 ? noches : 0;
}

// El importe guardado en la reserva manda sobre el calculado: es el que se
// acordó de verdad, y las tarifas pueden haber cambiado desde entonces. Lo
// mismo con el anticipo, que puede no ser el 50% si se negoció distinto.
function estadiaDeLaReserva(reserva, periodos, casa, ci, co, fechaReserva) {
  const calculada = calcularEstadia(periodos, casa, ci, co, fechaReserva);

  const total = Number(reserva.importe);
  if (!Number.isFinite(total) || total <= 0) return calculada;

  const anticipo = Number(reserva.anticipo);
  const sena = Number.isFinite(anticipo) && anticipo > 0
    ? Math.round(anticipo)
    : Math.round(total * 0.5);

  const saldo = Math.round(total) - sena;

  return {
    noches: calculada ? calculada.noches : nochesEntre(ci, co),
    total: Math.round(total),
    sena,
    saldo,
    cuotas: saldo > 0 ? planDeCuotas(saldo, ci, fechaReserva) : [],
  };
}

function esTemporadaAltaYmd(ymd) {
  const m = String(ymd || "").slice(0, 10).match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return false;

  const mes = Number(m[1]);
  const dia = Number(m[2]);

  return (mes === 12 ? dia >= 20 : mes > 12) || (mes === 3 ? dia <= 1 : mes < 3);
}

// La temporada cruza el año nuevo, así que las cuotas se anclan al año en que
// arranca: una estadía de enero de 2027 paga en octubre y noviembre de 2026.
function anioDeTemporada(ymd) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})/);
  const anio = Number(m[1]);
  return Number(m[2]) >= 12 ? anio : anio - 1;
}

// Las cuotas son sólo para temporada alta, y cada tramo cuenta sólo si su
// vencimiento todavía no llegó cuando se reservó: reservando en noviembre o
// después ya no queda plan de cuotas y el saldo va en un pago.
function planDeCuotas(saldo, checkinYmd, fechaReserva) {
  if (!esTemporadaAltaYmd(checkinYmd)) return [];

  const anio = anioDeTemporada(checkinYmd);
  const hoy = String(fechaReserva || "").slice(0, 10) || new Date().toISOString().slice(0, 10);

  const vigentes = [
    { mes: "10", nombre: "octubre" },
    { mes: "11", nombre: "noviembre" },
  ].filter((t) => hoy < `${anio}-${t.mes}-01`);

  if (!vigentes.length) return [];

  // La última se lleva el redondeo para que las cuotas cierren el saldo exacto.
  const base = Math.round(saldo / vigentes.length);

  return vigentes.map((t, i) => ({
    numero: i + 1,
    monto: i === vigentes.length - 1 ? saldo - base * (vigentes.length - 1) : base,
    vence: `del 1 al 5 de ${t.nombre} de ${anio}`,
  }));
}

// ---------- huéspedes ----------

// Los acompañantes se guardan en `notes` con el formato que arma reservar.html
// ("Huéspedes: 1. Nombre (DNI 123) · 2. ..."). Si la reserva es vieja o vino
// por otro canal, al menos queda el titular.
function leerHuespedes(reserva) {
  if (Array.isArray(reserva.guests_details) && reserva.guests_details.length) {
    return reserva.guests_details
      .map((g) => ({ nombre: String(g.nombre || "").trim(), dni: String(g.dni || "").trim() }))
      .filter((g) => g.nombre);
  }

  const notas = String(reserva.notes || "");
  const desde = notas.indexOf("Huéspedes:");
  if (desde !== -1) {
    const lista = notas
      .slice(desde + "Huéspedes:".length)
      .split("·")
      .map((t) => t.trim().replace(/^\d+\.\s*/, ""))
      .map((t) => {
        const m = t.match(/^(.*?)\s*\(DNI\s*([^)]*)\)\s*$/i);
        return m ? { nombre: m[1].trim(), dni: m[2].trim() } : { nombre: t, dni: "" };
      })
      .filter((g) => g.nombre);
    if (lista.length) return lista;
  }

  const titular = String(reserva.guest_name || "").trim();
  return titular ? [{ nombre: titular, dni: String(reserva.dni || "").trim() }] : [];
}

// ---------- render ----------

function renderDocumento(reserva, periodos) {
  const casa = CASAS[String(reserva.house_code || "").toUpperCase()];
  if (!casa) throw new Error(`Casa desconocida: ${reserva.house_code}`);

  const huespedes = leerHuespedes(reserva);
  if (!huespedes.length) throw new Error("La reserva no tiene huéspedes cargados");

  const ci = String(reserva.check_in || "").slice(0, 10);
  const co = String(reserva.check_out || "").slice(0, 10);

  // Las cuotas dependen de cuándo se reservó, no de cuándo se confirma.
  const fechaReserva = String(reserva.created_at || "").slice(0, 10);
  const estadia = estadiaDeLaReserva(
    reserva, periodos, String(reserva.house_code).toUpperCase(), ci, co, fechaReserva
  );

  const listaHuespedes = huespedes
    .map((g) => `<li>${escapar(g.nombre)}${g.dni ? ` — DNI ${escapar(g.dni)}` : ""}</li>`)
    .join("");

  const bloqueImportes = estadia
    ? `
      <div class="fila"><span>Valor total del alquiler</span><strong>${pesos(estadia.total)}</strong></div>
      <div class="letras">(${importeEnLetras(estadia.total)})</div>

      <div class="fila recibido"><span>Recibimos en concepto de seña (${Math.round(estadia.sena / estadia.total * 100)}%)</span><strong>${pesos(estadia.sena)}</strong></div>
      <div class="letras">(${importeEnLetras(estadia.sena)})</div>

      <div class="fila"><span>Saldo</span><strong>${pesos(estadia.saldo)}</strong></div>

      ${estadia.cuotas.length ? `
      <table class="cuotas">
        <thead><tr><th>Cuota</th><th>Vencimiento</th><th>Monto</th></tr></thead>
        <tbody>
          ${estadia.cuotas.map((c) => `
            <tr>
              <td>${c.numero} de ${estadia.cuotas.length}</td>
              <td>${escapar(c.vence)}</td>
              <td class="monto">${pesos(c.monto)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <p class="nota">El saldo se abona en ${estadia.cuotas.length === 1 ? "1 cuota" : `${estadia.cuotas.length} cuotas mensuales consecutivas`}. Por otras modalidades de pago, consultar.</p>`
      : `<p class="nota">El saldo se abona en un pago, a coordinar con los propietarios. Por otras modalidades de pago, consultar.</p>`}`
    : `<p class="nota sinTarifa">Los importes de esta reserva se coordinan directamente con los propietarios.</p>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reserva ${escapar(reserva.id || "")} — Las Cañas</title>
<style>
  body { margin:0; padding:24px 12px; background:#F5F1E9; color:#4A3728;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
         font-size:15px; line-height:1.6; }
  .hoja { max-width:640px; margin:0 auto; background:#fff; border:1px solid #E4D9C8;
          border-radius:20px; overflow:hidden; }
  .cabecera { background:#4A3728; color:#F5F1E9; padding:28px 32px; text-align:center; }
  .marca { font-size:26px; font-weight:700; letter-spacing:.5px; margin:0; }
  .bajada { font-size:11px; text-transform:uppercase; letter-spacing:3px; opacity:.75; margin:6px 0 0; }
  .sello { display:inline-block; margin-top:16px; padding:7px 18px; border-radius:999px;
           background:#15803D; color:#fff; font-size:12px; font-weight:700;
           text-transform:uppercase; letter-spacing:1.5px; }
  .cuerpo { padding:28px 32px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:2px; color:#8C7B6B;
       margin:28px 0 12px; padding-bottom:6px; border-bottom:1px solid #E4D9C8; }
  h2:first-child { margin-top:0; }
  .intro { background:#F5F1E9; border-left:4px solid #4A3728; border-radius:0 12px 12px 0;
           padding:14px 18px; margin:0 0 4px; font-size:14px; }
  .fila { display:flex; justify-content:space-between; gap:16px; padding:9px 0;
          border-bottom:1px solid #F0EAE0; }
  .fila:last-of-type { border-bottom:none; }
  .fila span { color:#8C7B6B; }
  .fila strong { text-align:right; white-space:nowrap; }
  .fila.recibido strong { color:#15803D; }
  .letras { font-size:12px; color:#8C7B6B; font-style:italic; margin:-4px 0 8px; }
  ul { margin:0; padding-left:20px; }
  li { margin-bottom:7px; }
  .estadia { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:4px; }
  .caja { flex:1; min-width:150px; background:#F5F1E9; border:1px solid #E4D9C8;
          border-radius:14px; padding:14px 16px; }
  .caja .rotulo { font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:#8C7B6B; }
  .caja .valor { font-size:17px; font-weight:700; margin-top:3px; }
  .caja .hora { font-size:12px; color:#8C7B6B; }
  table.cuotas { width:100%; border-collapse:collapse; margin-top:14px; font-size:14px; }
  table.cuotas th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:1.5px;
                    color:#8C7B6B; padding:8px 10px; background:#F5F1E9; }
  table.cuotas th:last-child, table.cuotas td.monto { text-align:right; }
  table.cuotas td { padding:10px; border-bottom:1px solid #F0EAE0; }
  .nota { font-size:13px; color:#8C7B6B; margin-top:12px; }
  .sinTarifa { background:#F5F1E9; border-radius:12px; padding:14px 16px; margin:0; }
  .condiciones li { color:#4A3728; }
  .firma { margin-top:28px; padding-top:20px; border-top:1px solid #E4D9C8; }
  .firma .saludo { margin-bottom:14px; }
  .firma .nombre { font-weight:700; }
  .firma .dato { font-size:13px; color:#8C7B6B; }
  .pie { background:#F5F1E9; padding:20px 32px; text-align:center; font-size:12px; color:#8C7B6B; }
  .pie a { color:#4A3728; }
  @media print {
    body { background:#fff; padding:0; }
    .hoja { border:none; border-radius:0; max-width:none; }
  }
</style>
</head>
<body>
  <div class="hoja">
    <div class="cabecera">
      <p class="marca">Las Cañas</p>
      <p class="bajada">Mar de Cobo</p>
      <div class="sello">Reserva confirmada</div>
    </div>

    <div class="cuerpo">
      <p class="intro">
        Por medio de la presente se reserva la <strong>unidad ${escapar(casa.unidad)}</strong>
        (${escapar(casa.nombre)}), ${escapar(DIRECCION)}.
      </p>

      <h2>Huéspedes</h2>
      <ul>${listaHuespedes}</ul>

      <h2>Estadía</h2>
      <div class="estadia">
        <div class="caja">
          <div class="rotulo">Check-in</div>
          <div class="valor">${escapar(ymdADMY(ci))}</div>
          <div class="hora">a partir de las 14:00</div>
        </div>
        <div class="caja">
          <div class="rotulo">Check-out</div>
          <div class="valor">${escapar(ymdADMY(co))}</div>
          <div class="hora">hasta las 10:00</div>
        </div>
        ${estadia ? `<div class="caja">
          <div class="rotulo">Noches</div>
          <div class="valor">${estadia.noches}</div>
          <div class="hora">${escapar(String(reserva.guests || huespedes.length))} huésped(es)</div>
        </div>` : ""}
      </div>

      <h2>Importes</h2>
      ${bloqueImportes}

      <h2>Condiciones</h2>
      <ul class="condiciones">
        ${CONDICIONES.map((c) => `<li>${escapar(c)}</li>`).join("")}
      </ul>

      <div class="firma">
        <div class="saludo">Quedamos a tu disposición.</div>
        <div class="nombre">${escapar(PROPIETARIA.nombre)}</div>
        <div class="dato">DNI ${escapar(PROPIETARIA.dni)}</div>
        ${reserva.id ? `<div class="dato" style="margin-top:10px">Reserva ${escapar(reserva.id)}</div>` : ""}
      </div>
    </div>

    <div class="pie">
      Las Cañas · Mar de Cobo, Partido de Mar Chiquita<br>
      <a href="https://wa.me/542236882986">WhatsApp +54 223 688-2986</a>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  CASAS,
  numeroALetras,
  importeEnLetras,
  calcularEstadia,
  planDeCuotas,
  esTemporadaAltaYmd,
  leerHuespedes,
  renderDocumento,
};
