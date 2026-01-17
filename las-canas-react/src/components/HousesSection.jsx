import { useEffect, useMemo, useState } from "react";

const img = (path) => encodeURI(path);

const housesData = [
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
    images: [],
    comingSoon: true,
  },
  {
    id: 5,
    title: "Las Cañas 5",
    people: "Hasta 3",
    description:
      "Ideal para 2 adultos y 1 niño. A 1 cuadra de la playa. WiFi, Smart TV, parrilla y parque. No se aceptan mascotas.",
    images: [],
    comingSoon: true,
  },
];

function clampStyle(lines = 4) {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
}

export default function HousesSection() {
  const houses = useMemo(() => housesData, []);

  // Lightbox state (por casa)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeHouse, setActiveHouse] = useState(null); // { title, images }
  const [idx, setIdx] = useState(0);

  const images = activeHouse?.images || [];
  const current = images[idx];

  const openGallery = (house) => {
    if (!house?.images?.length) return; // no abre si no hay
    setActiveHouse({ title: house.title, images: house.images });
    setIdx(0);
    setLightboxOpen(true);
  };

  const close = () => setLightboxOpen(false);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  // Teclado: ESC / flechas
  useEffect(() => {
    if (!lightboxOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, images.length]);

  // Swipe mobile básico
  useEffect(() => {
    if (!lightboxOpen) return;

    let startX = 0;
    let endX = 0;

    const onTouchStart = (e) => {
      startX = e.touches?.[0]?.clientX ?? 0;
    };
    const onTouchMove = (e) => {
      endX = e.touches?.[0]?.clientX ?? 0;
    };
    const onTouchEnd = () => {
      const delta = endX - startX;
      if (Math.abs(delta) < 40) return;
      if (delta > 0) prev();
      else next();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [lightboxOpen, images.length]);

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

        {/* ✅ cards alineadas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 items-stretch">
          {houses.map((h) => {
            const hasPhotos = (h.images?.length || 0) > 0;

            return (
              <div
                key={h.id}
                className="group bg-white rounded-[2.5rem] overflow-hidden shadow-2xl hover:shadow-brand-brown/10 transition-all duration-500 border border-transparent hover:border-brand-beige h-full flex flex-col"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-brand-beige/20">
                  {hasPhotos ? (
                    <img
                      src={h.images[0]}
                      alt={h.title}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                      loading="lazy"
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

                <div className="p-10 flex flex-col flex-1">
                  <h3 className="text-3xl font-bold mb-4 serif italic text-brand-brown">
                    {h.title}
                  </h3>

                  <p
                    className="text-brand-brown/60 mb-8 text-sm leading-relaxed font-light"
                    style={clampStyle(4)}
                  >
                    {h.description}
                  </p>

                  <div className="mt-auto">
                    <div className="flex gap-3">
                      <a
                        href="/reservar.html"
                        className="flex-1 text-center py-5 bg-brand-cream hover:bg-brand-brown text-brand-brown hover:text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border border-brand-beige"
                      >
                        Reservar
                      </a>

                      {/* ✅ ahora abre galería de ESA casa */}
                      <button
                        type="button"
                        onClick={() => openGallery(h)}
                        disabled={!hasPhotos}
                        className={`w-[140px] text-center px-6 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border border-brand-beige ${
                          hasPhotos
                            ? "bg-white hover:bg-brand-cream text-brand-brown"
                            : "bg-white/60 text-brand-brown/40 cursor-not-allowed"
                        }`}
                        aria-label={
                          hasPhotos
                            ? `Ver fotos de ${h.title}`
                            : `Fotos de ${h.title} próximamente`
                        }
                        title={hasPhotos ? "Ver fotos" : "Próximamente"}
                      >
                        Ver fotos
                      </button>
                    </div>

                    {hasPhotos && h.images.length > 1 && (
                      <div className="mt-8 grid grid-cols-4 gap-3">
                        {h.images.slice(1, 5).map((src, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              // abrir en el índice correspondiente de esa casa
                              setActiveHouse({ title: h.title, images: h.images });
                              setIdx(i + 1);
                              setLightboxOpen(true);
                            }}
                            className="rounded-xl overflow-hidden border border-brand-beige/60 hover:scale-[1.03] transition-transform"
                            aria-label={`Abrir foto ${i + 2} de ${h.title}`}
                          >
                            <img
                              src={src}
                              alt={`${h.title} ${i + 2}`}
                              className="w-full h-full aspect-square object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ✅ Lightbox por casa */}
      {lightboxOpen && activeHouse && images.length > 0 && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Galería ${activeHouse.title}`}
        >
          <div className="w-full max-w-5xl">
            <div className="relative bg-black/40 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
              {/* top bar */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="text-white font-semibold serif italic">
                    {activeHouse.title}
                  </div>
                  <div className="text-white/70 text-xs font-black uppercase tracking-[0.22em]">
                    {idx + 1} / {images.length}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={close}
                  className="text-white/80 hover:text-white transition-colors text-2xl leading-none px-3 py-1 rounded-lg"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              {/* image */}
              <div className="relative w-full aspect-video bg-black">
                <img
                  src={current}
                  alt={`${activeHouse.title} foto ${idx + 1}`}
                  className="w-full h-full object-contain select-none"
                  draggable="false"
                />

                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/25 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors"
                  aria-label="Anterior"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/25 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors"
                  aria-label="Siguiente"
                >
                  ›
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/70 to-transparent">
                  <div className="text-white/60 text-xs">
                    Tip: flechas ← → para navegar · ESC para cerrar
                  </div>
                </div>
              </div>
            </div>

            {/* thumbnails */}
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`shrink-0 w-20 h-14 rounded-xl overflow-hidden border transition-all ${
                    i === idx ? "border-white/80" : "border-white/20 hover:border-white/40"
                  }`}
                  aria-label={`Ir a foto ${i + 1}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}