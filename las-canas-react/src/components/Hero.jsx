export default function Hero() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28 md:pt-36 pb-32"
    >
        {/* ✅ H1 SEO – invisible pero indexable */}
      <h1 className="sr-only">
        Las Cañas — Alquiler de casas en Mar de Cobo
      </h1>
      <p className="sr-only">
        Complejo Las Cañas en Mar de Cobo: alquiler de casas equipadas a 1 cuadra
        del mar, en el Partido de Mar Chiquita, Provincia de Buenos Aires. Alquiler
        temporario de casas frente al mar, ideal para familias y descanso en la costa.
      </p>
      <div className="absolute inset-0 z-0">
        <img
          src="/entradaVista1.jpg"
          alt="" // decorativo
          aria-hidden="true"
          className="w-full h-full object-cover grayscale-[0.15] sepia-[0.08]"
          onError={(e) => {
            // si falla la imagen del fondo, no queremos textos raros
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-brand-beige/30 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-cream via-transparent to-black/25" />
      </div>

      <div className="container mx-auto px-6 relative z-10 text-center">
        <div className="mb-10 flex justify-center">
          <div className="bg-brand-beige p-2 rounded-[3.5rem] shadow-2xl border border-white/30 max-w-md w-full overflow-hidden">
            <div className="bg-brand-beige border-4 border-white/40 rounded-[3rem] p-10 md:p-12 flex flex-col items-center">
              <img
                src="/logo.PNG"
                alt=""               // ✅ clave: evita el “Las Cañas” fantasma
                aria-hidden="true"
                className="w-full max-w-[320px] h-auto mb-6 logo-shadow block select-none"
                draggable="false"
                loading="eager"
                onError={(e) => {
                  // ✅ si falla el logo, lo ocultamos y listo (nada de alt flotando)
                  e.currentTarget.style.display = "none";
                }}
              />
              <div className="w-32 h-[1px] bg-brand-brown/30 mb-4" />
              <p className="text-brand-brown font-black tracking-[0.35em] uppercase text-[9px] md:text-[10px] opacity-80">
                Refugio de Mar
              </p>
            </div>
          </div>
        </div>

        <p className="text-xl md:text-3xl text-brand-brown max-w-2xl mx-auto mb-14 serif italic leading-relaxed font-light drop-shadow-sm">
          “Donde descansa el silencio, <br className="hidden md:block" /> a 1 cuadra del mar.”
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <a
            href="/reservar.html"
            className="group relative w-full sm:w-auto px-16 py-6 bg-brand-brown text-brand-cream rounded-full font-black text-xs uppercase tracking-[0.2em] overflow-hidden transition-all shadow-2xl hover:shadow-brand-brown/40"
          >
            <span className="relative z-10">Reservar estadía</span>
            <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
          </a>
          <a
            href="#casas"
            className="w-full sm:w-auto px-16 py-6 bg-white/40 hover:bg-white/90 backdrop-blur-lg text-brand-brown border border-white/60 rounded-full font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg"
          >
            Nuestras casas
          </a>
        </div>

        {/* La tienda no compite con "Reservar": va abajo, más chica, pero en
            la primera pantalla. */}
        <a
          href="#tienda"
          className="mt-8 inline-flex items-center gap-3 px-8 py-4 bg-brand-beige/90 hover:bg-brand-beige text-brand-brown rounded-full font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg"
        >
          <span aria-hidden="true">🏖️</span>
          Tienda de playa
        </a>
      </div>

      {/* ✅ Descubrir siempre visible, no se pisa */}
      <div className="absolute bottom-8 md:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-30 pointer-events-none">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-brown/40">
          Descubrir
        </span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-brand-brown/40 to-transparent" />
      </div>
    </section>
  );
}