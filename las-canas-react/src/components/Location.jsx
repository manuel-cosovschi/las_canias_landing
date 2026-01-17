export default function Location() {
  // 📍 Link externo (lo que te abre perfecto en Google Maps)
  const googleMapsLink = "https://maps.app.goo.gl/Y4pXNaTYMhq2seEV9?g_st=ic";

  // ✅ Embed por coordenadas exactas (pin correcto)
  const mapEmbed =
    "https://www.google.com/maps?q=-37.7705815,-57.4464581&z=17&output=embed";

  return (
    <section id="location" className="py-28 bg-brand-cream relative overflow-hidden">
      {/* decoración suave */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-beige/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />

      <div className="container mx-auto px-6 relative">
        <div className="flex flex-col lg:flex-row gap-16 items-center">
          {/* TEXTO */}
          <div className="w-full lg:w-2/5">
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
                    Partido de Mar Chiquita, Provincia de Buenos Aires. Un entorno natural,
                    tranquilo y rodeado de bosque.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm shrink-0 border border-brand-beige/50">
                  🌊
                </div>
                <div>
                  <h4 className="font-bold text-brand-brown text-lg">A metros del mar</h4>
                  <p className="text-brand-brown/60 text-sm leading-relaxed italic">
                    Las casas se encuentran a solo una cuadra de la playa, ideales para disfrutar
                    del sonido del mar y la calma del lugar.
                  </p>
                </div>
              </div>
            </div>

            <a
              href={googleMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-4 px-10 py-5 bg-brand-brown text-brand-cream rounded-full font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:bg-black hover:-translate-y-1 group"
            >
              Abrir en Google Maps
              <span className="text-lg group-hover:translate-x-1 transition-transform">↗</span>
            </a>
          </div>

          {/* MAPA */}
          <div className="w-full lg:w-3/5">
            <div className="relative group">
              <div className="absolute -inset-4 bg-brand-beige/40 rounded-[3rem] -z-10 transition-transform duration-700 group-hover:scale-[1.02]" />

              <div className="aspect-video w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white/50 relative">
                <iframe
                  src={mapEmbed}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Ubicación Las Cañas - Mar de Cobo"
                  className="grayscale hover:grayscale-0 transition-all duration-700"
                />

                {/* badge flotante */}
                <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-brand-beige">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-brown">
                    Las Cañas
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}