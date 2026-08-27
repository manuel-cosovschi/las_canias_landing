// Cliente de la tienda.
//
// El catálogo ya no vive acá: lo cargan los dueños desde el panel y queda en
// el servidor. Eso es lo que hace que el "Próximamente" sirva de algo —
// mientras la tienda no esté publicada, el visitante no recibe ni los nombres.
// Cuando el catálogo estaba en este archivo, viajaba en el javascript de la
// página y cualquiera lo leía con el inspector.

export const EP_CATALOGO = "/.netlify/functions/store-catalog";
export const EP_FOTO = "/.netlify/functions/store-photo";
export const EP_LOGIN = "/.netlify/functions/auth-login";

// El número al que llegan los pedidos. Es el mismo del botón flotante de
// WhatsApp, para no terminar con dos números distintos dando vueltas.
export const WHATSAPP_TIENDA = "542236882986";

// El espacio entre el signo y el número es duro (U+00A0), igual que en el
// panel: si no, en una tarjeta angosta el "$" queda solo en un renglón y el
// número en el siguiente. Va escapado y no literal porque eslint no deja
// espacios invisibles en el código, y con razón: no se ven al leerlo.
export const pesosAR = (n) =>
  typeof n === "number" && Number.isFinite(n)
    ? "$ " + Math.round(n).toLocaleString("es-AR")
    : "Consultar";

export const fotoDe = (p) => (p.tieneFoto ? `${EP_FOTO}?id=${encodeURIComponent(p.id)}` : null);

// El mensaje llega con el producto ya escrito: si el dueño tiene que
// preguntar "¿cuál querías?", se pierde la mitad de los pedidos.
export const linkPedido = (producto) => {
  const texto = `Hola! Quería consultar por: ${producto.nombre}` +
    (typeof producto.precio === "number" ? ` (${pesosAR(producto.precio)})` : "");
  return `https://wa.me/${WHATSAPP_TIENDA}?text=${encodeURIComponent(texto)}`;
};

// Con el secret vuelve todo, publicado o no. Sin él, si la tienda está en
// "Próximamente", el servidor no manda ningún producto.
export async function traerCatalogo(secret) {
  const res = await fetch(EP_CATALOGO, {
    headers: secret ? { "x-lc-secret": secret } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || "No se pudo cargar la tienda");
  }
  return {
    publicada: Boolean(data.publicada),
    productos: Array.isArray(data.productos) ? data.productos : [],
  };
}

export async function entrarComoDueno(username, password) {
  const res = await fetch(EP_LOGIN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.message || "Usuario o contraseña incorrectos");
  }
  return data.owner_secret;
}
