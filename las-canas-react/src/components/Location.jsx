export default function Location() {
  const mapUrl =
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d12577.781190457632!2d-57.45654344583152!3d-37.75734299499887!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9590623f95b5b9e1%3A0xc47e450b286663f7!2sMar%20de%20Cobo%2C%20Provincia%20de%20Buenos%20Aires!5e0!3m2!1ses-419!2sar!4v1710000000000!5m2!1ses-419!2sar";

  const externalMapLink =
    "https://www.google.com/maps/search/Las+Cañas+Mar+de+Cobo/@-37.757343,-57.456543,15z";

  return (
    <section id="location" className="py-24 bg-brand-cream relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-beige/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-beige/15 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

      <div className="container mx-auto px-6 relative">
        <div className="flex flex-col lg:flex-row gap-16 items-center">
          <div className="w-full lg:w-2/5 order-2 lg:order-1">
            <span className="text-brand-accent font-bold tracking-[0.3em] uppercase text-xs mb-4 block">
              Ubicación
            </span>

            <h2 className="text-4xl md:text-5xl font-bold mb-8 text-brand-brown serif italic">
              Dónde estamos
            </h2>

            <div className="space-y-8 mb-12">
              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm shrink-0 border border-brand-beige/50">
                  📍
                </div>
                <div>
                  <h4 className="font-bold text-brand-brown text-lg">Mar de Cobo</h4>
                  <p className="text-brand-brown/60 text-sm leading-relaxed italic">
                    Un balneario tranquilo del Partido de Mar Chiquita, rodeado de bosque y mar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm shrink-0 border border-brand-beige/50">
                  🌊
                </div>
                <div>
                  <h4 className="font-bold text-brand-brown text-lg">A pasos de la playa</h4>
                  <p className="text-brand-brown/60 text-sm leading-relaxed italic">
                    Ideal para descansar y desconectar cerca del mar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm shrink-0 border border-brand-beige/50">
                  🚗
                </div>
                <div>
                  <h4 className="font-bold text-brand-brown text-lg">Acceso simple</h4>
                  <p className="text-brand-brown/60 text-sm leading-relaxed italic">
                    Llegás fácil desde Mar del Plata por ruta y calles tranquilas.
                  </p>
                </div>
              </div>
            </div>

            <a
              href={externalMapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-4 px-10 py-5 bg-brand-brown text-brand-cream rounded-full font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:bg-black hover:-translate-y-1 group"
            >
              Abrir en Google Maps
              <span className="text-lg group-hover:translate-x-1 transition-transform">↗</span>
            </a>
          </div>

          <div className="w-full lg:w-3/5 order-1 lg:order-2">
            <div className="relative group">
              <div className="absolute -inset-4 bg-brand-beige/40 rounded-[3rem] -z-10 transition-transform duration-700 group-hover:scale-[1.02]" />

              <div className="aspect-video w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white/50 relative bg-white">
                <iframe
                  src={mapUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Ubicación Las Cañas"
                  className="grayscale hover:grayscale-0 transition-all duration-700"
                />

                <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-brand-beige">
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-brown">
                    Mar de Cobo
                  </span>
                </div>

                <a
                  href={externalMapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-6 right-6 bg-white/90 hover:bg-white text-brand-brown px-5 py-3 rounded-full shadow-lg border border-brand-beige text-[10px] font-black uppercase tracking-widest transition-all"
                  title="Abrir en Maps"
                >
                  Ver en Maps ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}