import { useCallback, useEffect, useState } from "react";
import { pesosAR, fotoDe, linkPedido, traerCatalogo, entrarComoDueno } from "../data/tienda.js";

// La tienda del complejo: reposeras y cosas de playa. El catálogo lo cargan
// los dueños desde el panel y vive en el servidor.
//
// Mientras no la publiquen, el visitante ve un "Próximamente" y el servidor
// no le manda ni un nombre. Los dueños entran con la misma clave del panel y
// ven el catálogo entero para revisarlo antes de publicar.
const LLAVE = "lc_owner_secret";

export default function Tienda() {
  const [publicada, setPublicada] = useState(false);
  const [productos, setProductos] = useState([]);
  const [secret, setSecret] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [abriendo, setAbriendo] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [yendo, setYendo] = useState(false);

  const cargar = useCallback(async (conSecret) => {
    try {
      const cat = await traerCatalogo(conSecret);
      setPublicada(cat.publicada);
      setProductos(cat.productos);
    } catch {
      // Que la tienda no cargue no puede romper el resto de la página: se
      // queda en "Próximamente", que es el estado seguro.
      setPublicada(false);
      setProductos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    let guardado = null;
    try { guardado = localStorage.getItem(LLAVE); } catch { /* almacenamiento bloqueado */ }
    setSecret(guardado);
    cargar(guardado);
  }, [cargar]);

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    setYendo(true);
    try {
      const nuevo = await entrarComoDueno(usuario.trim(), clave);
      try { localStorage.setItem(LLAVE, nuevo); } catch { /* vale para esta visita */ }
      setSecret(nuevo);
      setAbriendo(false);
      setCargando(true);
      await cargar(nuevo);
    } catch (err) {
      setError(err.message || "No se pudo verificar");
    } finally {
      setYendo(false);
    }
  };

  const salir = async () => {
    try { localStorage.removeItem(LLAVE); } catch { /* nada que borrar */ }
    setSecret(null);
    setCargando(true);
    await cargar(null);
  };

  // Con secret puesto, lo que se ve es una vista previa: el visitante común
  // sigue viendo el cartel hasta que la publiquen desde el panel.
  //
  // Sin productos no hay vista previa que valga: va el cartel para todos, con
  // dueño o sin dueño. Antes acá salía un aviso interno diciendo dónde
  // cargarlos, y terminaba en la home de producción — el dueño abre la página
  // en el celular, tiene la llave guardada del panel, y se come un mensaje
  // para programadores en el medio del sitio. Eso se dice en el panel, que es
  // donde se cargan.
  const hayProductos = productos.length > 0;
  const espiando = Boolean(secret) && !publicada && hayProductos;
  const hayQueMostrar = (publicada || espiando) && hayProductos;

  return (
    <section id="tienda" className="py-20 md:py-28 bg-brand-brown text-brand-cream">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[11px] font-black tracking-[0.3em] uppercase text-brand-beige mb-4">
            Tienda
          </p>
          <h2 className="serif text-4xl md:text-5xl font-bold mb-4">
            Todo para la playa
          </h2>
          <p className="text-brand-beige/90 leading-relaxed">
            Reposeras, sombrillas y lo que haga falta para el día de playa.
          </p>
        </div>

        {espiando && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <span className="px-4 py-2 rounded-full bg-brand-beige text-brand-brown text-[11px] font-black uppercase tracking-[0.2em]">
              Vista de dueños
            </span>
            <span className="text-xs text-brand-beige/80">
              El público ve “Próximamente”. Se publica desde el panel.
            </span>
            <button
              type="button"
              onClick={salir}
              className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-beige/70 hover:text-brand-beige underline underline-offset-4"
            >
              Salir de la vista
            </button>
          </div>
        )}

        {/* Mientras se pregunta al servidor no va ningún texto: el título de
            arriba ya ocupa la sección, y poner "Cargando…" es un parpadeo de
            más antes del cartel. */}
        {cargando ? null : hayQueMostrar ? (
          <Catalogo productos={productos} />
        ) : (
          <Proximamente
            abriendo={abriendo}
            onAbrir={() => setAbriendo(true)}
            onCerrar={() => { setAbriendo(false); setError(""); }}
            usuario={usuario}
            setUsuario={setUsuario}
            clave={clave}
            setClave={setClave}
            error={error}
            yendo={yendo}
            onEntrar={entrar}
          />
        )}
      </div>
    </section>
  );
}

function Proximamente(props) {
  const { abriendo, onAbrir, onCerrar, usuario, setUsuario, clave, setClave, error, yendo, onEntrar } = props;

  return (
    <div className="max-w-lg mx-auto text-center">
      <p className="inline-block px-6 py-2 rounded-full bg-brand-beige text-brand-brown text-[11px] font-black uppercase tracking-[0.24em] mb-6">
        Próximamente
      </p>
      <p className="text-brand-beige/90 leading-relaxed mb-8">
        Estamos armando la tienda. Muy pronto vas a poder pedir todo desde acá.
        Mientras tanto, escribinos y lo vemos.
      </p>

      {!abriendo ? (
        // Discreto a propósito: es para los dueños, no para el visitante.
        <button
          type="button"
          onClick={onAbrir}
          className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-beige/60 hover:text-brand-beige transition-colors underline underline-offset-4"
        >
          Soy dueño
        </button>
      ) : (
        <form onSubmit={onEntrar} className="text-left bg-brand-cream text-brand-brown rounded-3xl p-6 shadow-xl">
          <p className="font-semibold text-sm mb-1">Vista de dueños</p>
          <p className="text-xs text-brand-accent mb-4">
            Con el mismo usuario y contraseña del panel.
          </p>

          <label className="block mb-3">
            <span className="block text-xs font-semibold mb-1">Usuario</span>
            <input
              type="text"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full border border-brand-beige rounded-2xl p-3 bg-white"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-xs font-semibold mb-1">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className="w-full border border-brand-beige rounded-2xl p-3 bg-white"
            />
          </label>

          {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={yendo}
              className="grow bg-brand-brown hover:bg-black text-brand-cream px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50"
            >
              {yendo ? "Verificando..." : "Ver la tienda"}
            </button>
            <button
              type="button"
              onClick={onCerrar}
              className="px-6 py-3 rounded-full border border-brand-beige text-[11px] font-black uppercase tracking-[0.2em] hover:bg-brand-beige/30 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Catalogo({ productos }) {
  // Se agrupa por categoría sólo si alguien las cargó; si no, una sola grilla.
  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))];
  const grupos = categorias.length
    ? categorias.map((c) => ({ titulo: c, items: productos.filter((p) => p.categoria === c) }))
    : [{ titulo: null, items: productos }];

  // Los que no tienen categoría no se pierden: van al final, sin título.
  const sueltos = categorias.length ? productos.filter((p) => !p.categoria) : [];
  if (sueltos.length) grupos.push({ titulo: null, items: sueltos });

  return grupos.map((grupo, i) => (
    <div key={grupo.titulo || `sueltos-${i}`} className="mb-12 last:mb-0">
      {grupo.titulo && (
        <h3 className="serif text-2xl font-bold mb-6 text-center md:text-left">
          {grupo.titulo}
        </h3>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {grupo.items.map((p) => {
          const foto = fotoDe(p);
          return (
            <article
              key={p.id}
              className="bg-brand-cream text-brand-brown rounded-3xl overflow-hidden shadow-xl flex flex-col"
            >
              {foto ? (
                <img
                  src={foto}
                  alt={p.nombre}
                  loading="lazy"
                  className="w-full aspect-square object-cover"
                />
              ) : (
                // Sin foto la tarjeta no se rompe ni queda un hueco raro. No
                // va el nombre acá: ya está abajo, y repetido queda pobre.
                <div className="w-full aspect-square bg-brand-beige/60 flex items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-brown/40">
                    Sin foto
                  </span>
                </div>
              )}

              <div className="p-6 flex flex-col grow">
                <h4 className="serif text-xl font-bold">{p.nombre}</h4>
                {p.descripcion && (
                  <p className="text-sm text-brand-accent mt-2 grow">{p.descripcion}</p>
                )}

                <p className="serif text-2xl font-bold mt-4 tabular-nums whitespace-nowrap">
                  {pesosAR(p.precio)}
                </p>

                {p.agotado ? (
                  <span className="mt-4 inline-block text-center px-6 py-3 rounded-full border border-brand-beige text-[11px] font-black uppercase tracking-[0.2em] text-brand-accent">
                    Sin stock
                  </span>
                ) : (
                  <a
                    href={linkPedido(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-center bg-brand-brown hover:bg-black text-brand-cream px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg"
                  >
                    Lo quiero
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  ));
}
