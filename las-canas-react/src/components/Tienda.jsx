import { useEffect, useState } from "react";
import { PRODUCTOS, hayTienda, pesosAR, linkPedido } from "../data/tienda.js";

// La tienda del complejo: reposeras y cosas de playa. Vive adentro de la
// landing y el pedido se cierra por WhatsApp, el mismo canal por el que ya
// entran las reservas.
//
// Mientras se arma, el público ve un "Próximamente" y sólo los dueños ven el
// catálogo. La clave no está en el código: se valida contra auth-login, la
// misma función y las mismas credenciales del panel de dueños. Una contraseña
// escrita en el javascript la lee cualquiera que abra el inspector.
const LLAVE = "lc_tienda_dueno";

export default function Tienda() {
  const [esDueno, setEsDueno] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [yendo, setYendo] = useState(false);

  useEffect(() => {
    try {
      // Si ya entraron al panel en este navegador, no se les pide de nuevo.
      const yaEntro = localStorage.getItem(LLAVE) === "1" ||
        Boolean(localStorage.getItem("lc_owner_secret"));
      if (yaEntro) setEsDueno(true);
    } catch {
      // Navegador con el almacenamiento bloqueado: se queda como público.
    }
  }, []);

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    setYendo(true);
    try {
      const res = await fetch("/.netlify/functions/auth-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usuario.trim(), password: clave }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || "Usuario o contraseña incorrectos");
        return;
      }
      try { localStorage.setItem(LLAVE, "1"); } catch { /* sin almacenamiento, vale para esta visita */ }
      setEsDueno(true);
    } catch {
      setError("No se pudo verificar. Probá de nuevo.");
    } finally {
      setYendo(false);
    }
  };

  const salir = () => {
    try { localStorage.removeItem(LLAVE); } catch { /* nada que borrar */ }
    setEsDueno(false);
    setAbriendo(false);
  };

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

        {esDueno ? (
          <VistaDueno onSalir={salir} />
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

function VistaDueno({ onSalir }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        <span className="px-4 py-2 rounded-full bg-brand-beige text-brand-brown text-[11px] font-black uppercase tracking-[0.2em]">
          Vista de dueños
        </span>
        <span className="text-xs text-brand-beige/80">
          El público ve “Próximamente”.
        </span>
        <button
          type="button"
          onClick={onSalir}
          className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-beige/70 hover:text-brand-beige underline underline-offset-4"
        >
          Salir de la vista
        </button>
      </div>

      {!hayTienda ? (
        <p className="text-center text-brand-beige/80 max-w-lg mx-auto">
          Todavía no hay productos cargados. Se cargan en
          <code className="mx-1 px-2 py-0.5 rounded bg-brand-cream/15">src/data/tienda.js</code>
          y aparecen acá.
        </p>
      ) : (
        <Catalogo />
      )}
    </>
  );
}

function Catalogo() {
  // Se agrupa por categoría sólo si alguien las cargó; si no, una sola grilla.
  const categorias = [...new Set(PRODUCTOS.map((p) => p.categoria).filter(Boolean))];
  const grupos = categorias.length
    ? categorias.map((c) => ({ titulo: c, items: PRODUCTOS.filter((p) => p.categoria === c) }))
    : [{ titulo: null, items: PRODUCTOS }];

  // Los que no tienen categoría no se pierden: van al final, sin título.
  const sueltos = categorias.length ? PRODUCTOS.filter((p) => !p.categoria) : [];
  if (sueltos.length) grupos.push({ titulo: null, items: sueltos });

  return grupos.map((grupo, i) => (
    <div key={grupo.titulo || `sueltos-${i}`} className="mb-12 last:mb-0">
      {grupo.titulo && (
        <h3 className="serif text-2xl font-bold mb-6 text-center md:text-left">
          {grupo.titulo}
        </h3>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {grupo.items.map((p) => (
          <article
            key={p.id}
            className="bg-brand-cream text-brand-brown rounded-3xl overflow-hidden shadow-xl flex flex-col"
          >
            {p.foto ? (
              <img
                src={p.foto}
                alt={p.nombre}
                loading="lazy"
                className="w-full aspect-square object-cover"
              />
            ) : (
              // Sin foto la tarjeta no se rompe ni queda un hueco raro.
              <div className="w-full aspect-square bg-brand-beige/60 flex items-center justify-center px-6">
                <span className="serif text-xl text-center text-brand-brown/70">
                  {p.nombre}
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
        ))}
      </div>
    </div>
  ));
}
