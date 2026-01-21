import { useEffect, useMemo, useState } from "react";

const img = (path) => encodeURI(path);
const vid = (path) => encodeURI(path);

/**
 * Datos según Master Doc (baños/ambientes/camas/observaciones + servicios comunes).
 * Fuente: Las Cañas - Master Doc.pdf  [oai_citation:1‡Las Cañas - Master Doc.pdf](sediment://file_00000000aa9c720eb8e8202bff6133a1)
 */
const COMMON = {
  badges: [
    "WiFi (Starlink)",
    "Smart TV",
    "Cocina equipada",
    "Parrilla privada",
    "Parque",
  ],

  // ✅ solo cosas que SÍ incluye (con tilde en UI)
  includes: [
    "Toallas de manos y toallones",
    "Calefacción",
    "2 ventiladores grandes de pie",
    "Mosquiteros",
    "Ducha exterior",
  ],
};

const housesData = [
  {
    id: 1,
    code: "LC1",
    title: "Las Cañas 1",
    people: "Hasta 4",
    description:
      "Equipada, cómoda y a 1 cuadra de la playa. Ideal para familias. No se aceptan mascotas.",
    details: {
      ambientes: "2",
      plantas: "2 plantas",
      banos: "2 (1 baño + 1 toilette)",
      camas: "3 (1 queen + 2 singles)",
      extra: "Ocupación ideal: 2 adultos + 2 niños (o 3 adultos + 1 niño)",
    },
    highlights: [
      "A 1 cuadra de la playa",
      "Parque y parrilla privada",
      "Ideal familias",
    ],
    images: [
      // AFUERA / ENTRADA
      img("/Casa 1 Imagenes/Entrada1LC1.jpeg"),
      img("/Casa 1 Imagenes/Entrada2LC1.jpeg"),
      img("/Casa 1 Imagenes/EntradaILC1.jpeg"),
      img("/Casa 1 Imagenes/MesaEntrada1LC1.jpeg"),
      img("/Casa 1 Imagenes/MesaEntradaLC1.jpeg"),

      // VIDEO (siempre lo ponemos después de la entrada para que “arranque” afuera)
      vid("/Casa 1 Imagenes/video1.MP4"),
      vid("/Casa 1 Imagenes/video1extra.MP4"),

      // TRANSICIÓN / ESCALERA / PASILLO
      img("/Casa 1 Imagenes/EscaleraLC1.jpeg"),
      img("/Casa 1 Imagenes/PasilloLC1.jpeg"),

      // LIVING / ESTAR
      img("/Casa 1 Imagenes/FULLLivingLC1.jpeg"),
      img("/Casa 1 Imagenes/Living+CocinaLC1.jpeg"),
      img("/Casa 1 Imagenes/Living+Cocina1LC1.jpeg"),

      // HABITACIÓN
      img("/Casa 1 Imagenes/Habitacion1LC1.jpeg"),

      // BAÑOS
      img("/Casa 1 Imagenes/Baño1LC1.jpeg"),
      img("/Casa 1 Imagenes/Ducha1LC1.jpeg"),
      img("/Casa 1 Imagenes/ToiletteLC1.jpeg"),

      // PATIO / PARQUE
      img("/Casa 1 Imagenes/patio1.JPG"),
      img("/Casa 1 Imagenes/patio1extra.JPG"),
      img("/Casa 1 Imagenes/Patio1LC1.jpeg"),
      img("/Casa 1 Imagenes/vistapatio1LC1.JPG"),
    ],
  },
  {
    id: 2,
    code: "LC2",
    title: "Las Cañas 2",
    people: "Hasta 4",
    description:
      "Única con 2 Smart TVs (living y habitación). Cómoda y funcional. No se aceptan mascotas.",
    details: {
      ambientes: "2",
      plantas: "2 plantas",
      banos: "2 (1 baño + 1 toilette)",
      camas: "4",
      extra: "Ocupación ideal: 2 adultos + 2 niños (o 3 adultos + 1 niño)",
    },
    highlights: ["2 Smart TVs", "Parrilla privada", "Parque"],
    images: [
      // AFUERA / ENTRADA
      img("/Casa 2 Imagenes/EntradaLC2.jpeg"),
      img("/Casa 2 Imagenes/Bienvenida1LC2.jpeg"),
      img("/Casa 2 Imagenes/Bienvenida2LC2.jpeg"),
      img("/Casa 2 Imagenes/EntradaInteriorLC2.jpeg"),

      // TRANSICIÓN / ESCALERA
      img("/Casa 2 Imagenes/Escalera1LC2.jpeg"),
      img("/Casa 2 Imagenes/SubidaLC2.jpeg"),

      // LIVING / COCINA
      img("/Casa 2 Imagenes/Living1LC2.jpeg"),
      img("/Casa 2 Imagenes/Living+CocinaLC2.jpeg"),

      // HABITACIONES
      img("/Casa 2 Imagenes/Habitacion1LC2.jpeg"),
      img("/Casa 2 Imagenes/Habitacion2LC2.jpeg"),

      // BAÑOS
      img("/Casa 2 Imagenes/BañoLC2.jpeg"),
      img("/Casa 2 Imagenes/ToiletteLC2.jpeg"),

      // PATIO
      img("/Casa 2 Imagenes/PatioLC2.jpeg"),
    ],
  },
  {
    id: 3,
    code: "LC3",
    title: "Las Cañas 3",
    people: "Hasta 5",
    description:
      "Ideal para familias y grupos tranquilos. Amplia y práctica. No se aceptan mascotas.",
    details: {
      ambientes: "3",
      plantas: "2 plantas",
      banos: "2 (1 baño + 1 toilette)",
      camas: "5 + carrito",
      extra:
        "Ideal para 5. Capacidad máxima: 6 personas (incluye 1 niño y 1 adolescente).",
    },
    highlights: ["Más capacidad", "Parrilla privada", "Parque"],
    images: [
      // AFUERA / ENTRADA
      img("/Casa 3 Imagenes/EntradaLC3.jpeg"),

      // VIDEO (ideal cerca de entrada para “recorrido”)
      vid("/Casa 3 Imagenes/videoLC3.MP4"),

      // TRANSICIÓN / ESCALERAS
      img("/Casa 3 Imagenes/Escalera1LC3.jpeg"),
      img("/Casa 3 Imagenes/Escalera2LC3.jpeg"),

      // LIVING / COMEDOR
      img("/Casa 3 Imagenes/Living1LC3.jpeg"),
      img("/Casa 3 Imagenes/Living+ComedorLC3.jpeg"),

      // COCINA / COMEDOR (DETALLE)
      img("/Casa 3 Imagenes/Cocina+ComedorLC3.jpeg"),
      img("/Casa 3 Imagenes/Comedor1LC3.jpeg"),

      // HABITACIONES
      img("/Casa 3 Imagenes/Habitacion1LC3.jpeg"),
      img("/Casa 3 Imagenes/Habitacion1BLC3.jpeg"),
      img("/Casa 3 Imagenes/HabitacionLC3.jpeg"),
      img("/Casa 3 Imagenes/VistaHabitacionLC3.jpeg"),

      // BAÑOS
      img("/Casa 3 Imagenes/BañoLC3.jpeg"),
      img("/Casa 3 Imagenes/Toilette1LC3.jpeg"),

      // PATIO
      img("/Casa 3 Imagenes/PatioLC3.jpeg"),
    ],
  },
  {
    id: 4,
    code: "LC4",
    title: "Las Cañas 4",
    people: "Hasta 4",
    description:
      "Planta baja. Cómoda y práctica para familias. No se aceptan mascotas.",
    details: {
      ambientes: "2",
      plantas: "Planta baja",
      banos: "1 baño",
      camas: "4",
      extra:
        "Ideal para 2/3 adultos. Capacidad máxima: 2 adultos + 2 niños pequeños, o 3 adultos + 1 niño pequeño.",
    },
    highlights: ["Planta baja", "Parrilla privada", "Parque"],
    images: [
      // AFUERA / ENTRADA
      img("/Casa 4 Imagenes/EntradaLC4.jpeg"),
      img("/Casa 4 Imagenes/VistaEntradaLC4.jpeg"),

      // LIVING / COCINA
      img("/Casa 4 Imagenes/LivingLC4.jpeg"),
      img("/Casa 4 Imagenes/Living1LC4.jpeg"),
      img("/Casa 4 Imagenes/Living+CocinaLC4.jpeg"),
      img("/Casa 4 Imagenes/Living+Cocina1LC4.jpeg"),
      img("/Casa 4 Imagenes/CocinaLC4.jpeg"),
      img("/Casa 4 Imagenes/Cocina1LC4.jpeg"),

      // HABITACIÓN
      img("/Casa 4 Imagenes/Habitacion1LC4.jpeg"),
      img("/Casa 4 Imagenes/HabitacionLC4.jpeg"),

      // BAÑO
      img("/Casa 4 Imagenes/BañoLC4.jpeg"),
      img("/Casa 4 Imagenes/Ducha1LC4.jpeg"),
      img("/Casa 4 Imagenes/Ducha2LC4.jpeg"),
      img("/Casa 4 Imagenes/DuchaLC4.jpeg"),
      img("/Casa 4 Imagenes/ToiletteLC4.jpeg"),

      // PATIO
      img("/Casa 4 Imagenes/PatioLC4.jpeg"),
      img("/Casa 4 Imagenes/Patio1LC4.jpeg"),
      img("/Casa 4 Imagenes/Patio2LC4.jpeg"),
    ],
  },
  {
    id: 5,
    code: "LC5",
    title: "Las Cañas 5",
    people: "2 adultos + 1 niño",
    description:
      "Ideal para parejas o familia chica. Planta baja. No se aceptan mascotas.",
    details: {
      ambientes: "2",
      plantas: "Planta baja",
      banos: "1 baño",
      camas: "2 + futón",
      extra: "Máximo: 2 adultos + 1 menor",
    },
    highlights: ["Planta baja", "Parrilla privada", "Parque"],
    images: [
      // AFUERA / ENTRADA
      img("/Casa 5 Imagenes/EntradaLC5.jpeg"),
      img("/Casa 5 Imagenes/BienvenidaLC5.jpeg"),
      img("/Casa 5 Imagenes/EntradaInteriorLC5.jpeg"),

      // LIVING / COMEDOR
      img("/Casa 5 Imagenes/Living+ComedorLC5.jpeg"),
      img("/Casa 5 Imagenes/Living+Comedor1LC5.jpeg"),
      img("/Casa 5 Imagenes/PasilloLC5.jpeg"),

      // HABITACIÓN
      img("/Casa 5 Imagenes/HabitacionLC5.jpeg"),

      // BAÑO
      img("/Casa 5 Imagenes/BañoLC5.jpeg"),
      img("/Casa 5 Imagenes/DuchaLC5.jpeg"),

      // TOILETTE (si realmente existen estas fotos y son baño “chico”, dejalas; si no existen, borrarlas)
      img("/Casa 5 Imagenes/Toilette1LC5.jpeg"),
      img("/Casa 5 Imagenes/ToiletteLC5.jpeg"),

      // PATIO
      img("/Casa 5 Imagenes/Patio1LC5.jpeg"),
      img("/Casa 5 Imagenes/PatioLC5.jpeg"),
      img("/Casa 5 Imagenes/VistaDesdePatioLC5.jpeg"),
    ],
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

function InfoChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-brand-beige/70 bg-brand-cream/40 px-4 py-3">
      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-brand-brown/60">
        {label}
      </div>
      <div className="text-sm font-semibold text-brand-brown mt-1">{value}</div>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-brand-beige/70 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-brand-brown/70">
      {children}
    </span>
  );
}

export default function HousesSection() {
  const houses = useMemo(() => housesData, []);

  // Lightbox state (por casa)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeHouse, setActiveHouse] = useState(null); // { title, images }
  const [idx, setIdx] = useState(0);

  const images = activeHouse?.images || [];
  const current = images[idx];

  const isVideo = (src) => {
    const s = String(src || "").toLowerCase();
    return s.endsWith(".mp4") || s.includes(".mp4?");
  };

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
                Entorno tranquilo, ideal para relajar.
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
                  <h3 className="text-3xl font-bold mb-3 serif italic text-brand-brown">
                    {h.title}
                  </h3>

                  {/* Chips principales */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {COMMON.badges.map((b) => (
                      <Pill key={b}>{b}</Pill>
                    ))}
                  </div>

                  <p
                    className="text-brand-brown/60 mb-6 text-sm leading-relaxed font-light"
                    style={clampStyle(4)}
                  >
                    {h.description}
                  </p>

                  {/* Detalles por casa */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <InfoChip label="Ambientes" value={h.details.ambientes} />
                    <InfoChip label="Baños" value={h.details.banos} />
                    <InfoChip label="Camas" value={h.details.camas} />
                    <InfoChip label="Distribución" value={h.details.plantas} />
                  </div>

                  {/* Observaciones importantes */}
                  {h.details?.extra && (
                    <div className="rounded-[1.5rem] border border-brand-beige/70 bg-brand-cream/50 p-5 mb-6">
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-brand-brown/60 mb-2">
                        Nota
                      </div>
                      <p className="text-sm text-brand-brown/70 leading-relaxed font-light">
                        {h.details.extra}
                      </p>
                    </div>
                  )}

                  {/* ✅ Aclaración sábanas (fuera de Incluye) */}
                  <div className="rounded-[1.5rem] border border-brand-beige/70 bg-brand-cream/50 p-5 mb-6">
                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-brand-brown/60 mb-2">
                      Aclaración
                    </div>
                    <p className="text-sm text-brand-brown/70 leading-relaxed font-light">
                      Cada huésped debe traer sus sábanas.
                    </p>
                  </div>

                  {/* ✅ Incluye (solo cosas que SÍ incluye, con tilde) */}
                  <div className="rounded-[1.5rem] border border-brand-beige/70 bg-white p-5 mb-8">
                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-brand-brown/60 mb-3">
                      Incluye
                    </div>

                    <ul className="grid grid-cols-1 gap-2 text-sm text-brand-brown/70 font-light">
                      {COMMON.includes.map((t) => (
                        <li key={t} className="flex items-start gap-2">
                          <span className="mt-[1px] text-brand-accent font-black">✓</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

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
                              setActiveHouse({ title: h.title, images: h.images });
                              setIdx(i + 1);
                              setLightboxOpen(true);
                            }}
                            className="rounded-xl overflow-hidden border border-brand-beige/60 hover:scale-[1.03] transition-transform"
                            aria-label={`Abrir item ${i + 2} de ${h.title}`}
                          >
                            {isVideo(src) ? (
                              <div className="relative w-full h-full">
                                <video
                                  src={src}
                                  className="w-full h-full aspect-square object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-black/45 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-full">
                                    Video
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={src}
                                alt={`${h.title} ${i + 2}`}
                                className="w-full h-full aspect-square object-cover"
                                loading="lazy"
                              />
                            )}
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

              {/* media */}
              <div className="relative w-full aspect-video bg-black">
                {isVideo(current) ? (
                  <video
                    src={current}
                    className="w-full h-full object-contain select-none"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={current}
                    alt={`${activeHouse.title} foto ${idx + 1}`}
                    className="w-full h-full object-contain select-none"
                    draggable="false"
                  />
                )}

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
                  aria-label={`Ir a item ${i + 1}`}
                >
                  {isVideo(src) ? (
                    <div className="relative w-full h-full">
                      <video
                        src={src}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/55 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
                          Video
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}