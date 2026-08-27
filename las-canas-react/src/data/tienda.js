// Catálogo de la tienda de Las Cañas.
//
// Este archivo es el único lugar donde se cargan los productos. Mientras esté
// vacío, la tienda no aparece en ningún lado: ni la sección, ni el botón del
// menú, ni el de la portada. Un link llamativo a una tienda sin productos es
// peor que no tenerlo, así que aparece sola cuando hay algo para vender.
//
// Cada producto:
//
//   {
//     id: "reposera-lona",              // interno, único, no se muestra
//     nombre: "Reposera de lona",
//     descripcion: "Plegable, con apoyabrazos de madera.",
//     precio: 85000,                    // en pesos. null = "Consultar"
//     foto: "/Tienda/reposera-lona.jpg",// dentro de public/Tienda/
//     categoria: "Reposeras",           // agrupa en la grilla; opcional
//     agotado: false,                   // true = se ve pero no se puede pedir
//   }
//
// Las fotos van en `public/Tienda/`. Conviene que sean cuadradas y livianas
// (menos de 300 KB): la portada de una casa pesada ya hace lenta la home.

export const PRODUCTOS = [];

// El número al que llegan los pedidos. Es el mismo del botón flotante de
// WhatsApp, para no terminar con dos números distintos dando vueltas.
export const WHATSAPP_TIENDA = "542236882986";

export const hayTienda = PRODUCTOS.length > 0;

// Los productos agotados igual se muestran (sirven para mostrar el surtido),
// pero no se puede pedirlos.
export const hayAlgoParaVender = PRODUCTOS.some((p) => !p.agotado);

// El espacio entre el signo y el número es duro (U+00A0), igual que en el
// panel: si no, en una tarjeta angosta el "$" queda solo en un renglón y el
// número en el siguiente. Va escapado y no literal porque eslint no deja
// espacios invisibles en el código, y con razón: no se ven al leerlo.
export const pesosAR = (n) =>
  typeof n === "number" && Number.isFinite(n)
    ? "$\u00a0" + Math.round(n).toLocaleString("es-AR")
    : "Consultar";

// El mensaje llega con el producto ya escrito: si el dueño tiene que
// preguntar "¿cuál querías?", se pierde la mitad de los pedidos.
export const linkPedido = (producto) => {
  const texto = `Hola! Quería consultar por: ${producto.nombre}` +
    (typeof producto.precio === "number" ? ` (${pesosAR(producto.precio)})` : "");
  return `https://wa.me/${WHATSAPP_TIENDA}?text=${encodeURIComponent(texto)}`;
};
