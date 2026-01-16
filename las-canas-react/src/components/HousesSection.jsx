const img = (path) => encodeURI(path);

const houses = [
  {
    id: 1,
    title: "Las Cañas 1",
    people: "Hasta 4",
    description:
      "Equipada, cómoda y a 1 cuadra de la playa. WiFi, Smart TV 42”, cocina completa, parrilla y parque privado. No se aceptan mascotas.",
    images: [
      img("/Casa 1 Imagenes/entradacasa1.JPG"),
      img("/Casa 1 Imagenes/living1.JPG"),
      img("/Casa 1 Imagenes/cocina1.JPG"),
      img("/Casa 1 Imagenes/patio1.JPG"),
    ],
  },
  {
    id: 2,
    title: "Las Cañas 2",
    people: "Hasta 4",
    description:
      "Única con 2 TVs Smart de 42” (living y habitación). WiFi, cocina completa, parrilla y parque. No se aceptan mascotas.",
    images: [
      img("/Casa 2 Imagenes/entrada2.JPG"),
      img("/Casa 2 Imagenes/entradaafuera2.JPG"),
      img("/Casa 2 Imagenes/cama2.JPG"),
      img("/Casa 2 Imagenes/parrilla2.JPG"),
    ],
  },
  {
    id: 3,
    title: "Las Cañas 3",
    people: "Hasta 6",
    description:
      "Ideal para familias y grupos. WiFi, Smart TV, cocina completa, parrilla y parque. No se aceptan mascotas.",
    images: [
      img("/Casa 3 Imagenes/livingEntrada3extra.JPG"),
      img("/Casa 3 Imagenes/living3.JPG"),
      img("/Casa 3 Imagenes/cocina3.JPG"),
      img("/Casa 3 Imagenes/patio3.JPG"),
    ],
  },
  {
    id: 4,
    title: "Las Cañas 4",
    people: "Hasta 4",
    description:
      "Ideal para 3 adultos o 2 adultos y 2 niños. A 1 cuadra de la playa. WiFi, Smart TV, parrilla y parque. No se aceptan mascotas.",
    images: [], // cuando tengas fotos, ponelas acá
    comingSoon: true,
  },
  {
    id: 5,
    title: "Las Cañas 5",
    people: "Hasta 3",
    description:
      "Ideal para 2 adultos y 1 niño. A 1 cuadra de la playa. WiFi, Smart TV, parrilla y parque. No se aceptan mascotas.",
    images: [], // cuando tengas fotos, ponelas acá
    comingSoon: true,
  },
];

export default function HousesSection() {
  return (
    <section id="casas" className="py-28 bg-brand-cream relative">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start mb-16 gap-10">
          <div className="max-w-2xl">
            <span className="text-brand-accent font-bold tracking-[0.3em] uppercase text-xs mb-4 block">
              Alojamiento
            </span>
            <h2 className="text-5xl md:text-6xl font-bold mb-6 text-brand-brown serif italic">
              Nuestras Casas
            </h2>
            <p className="text-lg text-brand-brown/70 leading-relaxed font-light max-w-lg">
              Cinco unidades independientes para descansar a metros del mar.
            </p>
          </div>

          <div className="bg-brand-beige/30 border border-brand-brown/10 p-7 rounded-[2rem] flex items-center gap-5 shadow-sm">
            <div className="text-3xl grayscale opacity-70">🌊</div>
            <div>
              <p className="text-sm font-bold text-brand-brown uppercase tracking-widest mb-1">
                A 1 cuadra de la playa
              </p>
              <p className="text-xs text-brand-brown/60 leading-relaxed italic">
                Entorno tranquilo, ideal para descansar.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {houses.map((h) => (
            <div
              key={h.id}
              className="group bg-white rounded-[2.5rem] overflow-hidden shadow-2xl hover:shadow-brand-brown/10 transition-all duration-500 border border-transparent hover:border-brand-beige"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-brand-beige/20">
                {h.images?.length ? (
                  <img
                    src={h.images[0]}
                    alt={h.title}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-brown/60">
                    Fotos disponibles pronto 📸
                  </div>
                )}

                <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black text-brand-brown uppercase tracking-widest shadow-lg">
                  {h.people}
                </div>

                {h.comingSoon && (
                  <div className="absolute top-6 right-6 bg-black/70 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Próximamente
                  </div>
                )}
              </div>

              <div className="p-10">
                <h3 className="text-3xl font-bold mb-4 serif italic text-brand-brown">{h.title}</h3>
                <p className="text-brand-brown/60 mb-8 text-sm leading-relaxed font-light">
                  {h.description}
                </p>

                <div className="flex gap-3">
                  <a
                    href="/reservar.html"
                    className="flex-1 text-center py-5 bg-brand-cream hover:bg-brand-brown text-brand-brown hover:text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border border-brand-beige"
                  >
                    Reservar
                  </a>
                  <a
                    href="#gallery"
                    className="px-6 py-5 bg-white hover:bg-brand-cream text-brand-brown rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border border-brand-beige"
                  >
                    Ver fotos
                  </a>
                </div>

                {h.images?.length > 1 && (
                  <div className="mt-8 grid grid-cols-4 gap-3">
                    {h.images.slice(1, 5).map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`${h.title} ${i + 2}`}
                        className="rounded-xl aspect-square object-cover border border-brand-beige/60 hover:scale-[1.03] transition-transform"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}