// node netlify/tests/plata.test.js
//
// Lo que importa acá es que un monto escrito a mano llegue entero a la
// planilla. Cada caso de abajo es una forma en la que los dueños escriben la
// plata, y los tres primeros son los que el panel estaba rompiendo.
//
// Vive acá y no al lado de _plata.js porque Netlify publica como función cada
// archivo de netlify/functions, y un nombre con punto —"_plata.test"— no es un
// nombre de función válido: el deploy entero falla por eso.

const assert = require("assert");
const { parsearMonto } = require("../functions/_plata");

const casos = [
  // [lo que escribe el dueño, lo que tiene que guardarse]
  ["300.000", 300000, "miles con punto: antes se guardaba 300"],
  ["1.333.000", 1333000, "dos puntos: antes era NaN y lo rechazaba"],
  ["$ 1.333.000", 1333000, "pegado con el signo adelante"],
  ["1333000", 1333000, "sin separadores, como estaba antes"],
  ["985715", 985715, ""],
  ["0", 0, "cero es un dato, no un vacío"],
  ["1.500", 1500, "en castellano mil quinientos, no uno y medio"],
  ["1,5", 1.5, "la coma sí es decimal"],
  ["1.333.000,50", 1333000.5, "miles con punto y decimales con coma"],
  ["1,333,000", 1333000, "al revés, como lo pega una planilla en inglés"],
  ["1,333,000.50", 1333000.5, ""],
  ["  1.200.000  ", 1200000, "con espacios al costado"],
  ["$1200000", 1200000, "sin espacio después del signo"],
  ["1 200 000", 1200000, "con espacios de miles"],
  ["ARS 450.000", 450000, "con la moneda escrita"],
  [1333000, 1333000, "ya es número"],
  ["-500", -500, "negativo: lo rechaza quien valida, no quien lee"],
  ["", null, "vacío no es cero"],
  ["   ", null, ""],
  ["-", null, "el guión del panel quiere decir borrar"],
  ["abc", null, ""],
  [null, null, ""],
  [undefined, null, ""],
  [NaN, null, ""],
];

let fallas = 0;
for (const [entrada, esperado, porque] of casos) {
  const salida = parsearMonto(entrada);
  try {
    assert.strictEqual(salida, esperado);
    console.log(`ok    ${JSON.stringify(entrada)} → ${salida}${porque ? "  (" + porque + ")" : ""}`);
  } catch {
    fallas++;
    console.log(`FALLA ${JSON.stringify(entrada)} → ${salida}, esperaba ${esperado}`);
  }
}

// Y el redondeo que hacen las funciones después de parsear.
const redondeo = [["1.333.000,49", 1333000], ["1.333.000,50", 1333001], ["999.999,99", 1000000]];
for (const [entrada, esperado] of redondeo) {
  const salida = Math.round(parsearMonto(entrada));
  if (salida === esperado) console.log(`ok    round(${entrada}) → ${salida}`);
  else { fallas++; console.log(`FALLA round(${entrada}) → ${salida}, esperaba ${esperado}`); }
}

console.log(fallas === 0 ? `\n✅ ${casos.length + redondeo.length} casos` : `\n❌ ${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
