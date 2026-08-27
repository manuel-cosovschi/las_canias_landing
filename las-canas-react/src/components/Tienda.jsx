import { PRODUCTOS, hayTienda, pesosAR, linkPedido } from "../data/tienda.js";

// La tienda del complejo: reposeras y cosas de playa. Vive adentro de la
// landing, como una sección más, y el pedido se cierra por WhatsApp — el
// mismo canal por el que ya entran las reservas.
//
// Si no hay productos cargados no se renderiza nada. Eso es a propósito: el
// botón del menú y el de la portada miran la misma bandera, así que la tienda
// entera aparece o desaparece junta y nunca queda un link a una página vacía.
export default function Tienda() {
  if (!hayTienda) return null;

  // Se agrupa por categoría sólo si alguien las cargó; si no, una sola grilla.
  const categorias = [...new Set(PRODUCTOS.map((p) => p.categoria).filter(Boolean))];
  const grupos = categorias.length
    ? categorias.map((c) => ({ titulo: c, items: PRODUCTOS.filter((p) => p.categoria === c) }))
    : [{ titulo: null, items: PRODUCTOS }];

  // Los que no tienen categoría no se pierden: van al final, sin título.
  const sueltos = categorias.length ? PRODUCTOS.filter((p) => !p.categoria) : [];
  if (sueltos.length) grupos.push({ titulo: null, items: sueltos });

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
            Elegís, nos escribís y lo coordinamos.
          </p>
        </div>

        {grupos.map((grupo, i) => (
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
                    // Sin foto la tarjeta no se rompe ni queda un hueco raro:
                    // se ve el nombre sobre el beige y listo.
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
        ))}
      </div>
    </section>
  );
}
