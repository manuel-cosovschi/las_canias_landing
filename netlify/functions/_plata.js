// netlify/functions/_plata.js
//
// Leer un monto escrito por una persona.
//
// Los dueños escriben la plata como la dicen: 1.333.000. Antes esto pasaba
// por `Number(String(v).replace(/[^\d.-]/g, ""))`, que en castellano hace dos
// destrozos silenciosos:
//
//   Number("300.000")    → 300          un precio de trescientos mil se
//                                       guardaba en trescientos pesos
//   Number("1.333.000")  → NaN          y el millón trescientos ni entraba:
//                                       "importe inválido" sin explicar por qué
//
// Acá el punto es separador de miles salvo que el número no tenga forma de
// miles (1.5 es uno y medio, 1.500 es mil quinientos), y la coma es la
// decimal. También se aceptan los dos al revés —"1,333,000" pegado de una
// planilla en inglés— porque el separador decimal es siempre el último.
//
// Devuelve un número, o null si no hay ningún número adentro.

const MILES_PUNTO = /^\d{1,3}(\.\d{3})+$/;
const MILES_COMA = /^\d{1,3}(,\d{3})+$/;

function parsearMonto(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  // Fuera el "$", los espacios (incluido el fino que pega Excel) y las letras.
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;

  const negativo = s.trimStart().startsWith("-");
  s = s.replace(/-/g, "");

  const coma = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");

  // Cuál de los dos es la coma decimal: el último, salvo que lo que hay sea
  // un número con separadores de miles y nada más.
  let decimal = -1;
  if (coma >= 0 && punto >= 0) decimal = Math.max(coma, punto);
  else if (coma >= 0) decimal = MILES_COMA.test(s) ? -1 : coma;
  else if (punto >= 0) decimal = MILES_PUNTO.test(s) ? -1 : punto;

  const entera = (decimal >= 0 ? s.slice(0, decimal) : s).replace(/[.,]/g, "");
  const decimales = decimal >= 0 ? s.slice(decimal + 1).replace(/[.,]/g, "") : "";

  const n = Number((entera || "0") + (decimales ? "." + decimales : ""));
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

module.exports = { parsearMonto };
