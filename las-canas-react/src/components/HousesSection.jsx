import { useCallback, useEffect, useMemo, useState } from "react";

import FOTOS_ORIGINALES from "../../public/fotos-casas.json";

// Las fotos de cada casa salen de dos lados:
//
// - las originales, que vienen en el repo (public/fotos-casas.json). Ese JSON
//   lo comparten la página y el panel, por eso no vive acá adentro.
// - las que los dueños arman desde el panel ("Fotos de las casas"), que
//   devuelve /api/house-gallery sólo para las casas que tocaron.
//
// Mientras la galería no contesta, las tarjetas esperan en vez de mostrar las
// originales: si no, quien entra ve una foto y al segundo la ve cambiar por
// otra. Si tarda demasiado o falla, quedan las originales.
const ESPERA_GALERIA_MS = 2500;

const esVideoPorNombre = (camino) => /\.(mp4|mov|webm)$/i.test(String(camino || ""));

const originales = (id) =>
  (FOTOS_ORIGINALES[id] || []).map((src) => ({ src, video: esVideoPorNombre(src) }));

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
    // ✅ además de COMMON.includes
    includesExtra: ["Aire acondicionado frío/calor"],
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
    // ✅ además de COMMON.includes
    includesExtra: ["Aire acondicionado frío/calor"],
  },
  {
    id: 5,
    code: "LC5",
    title: "Las Cañas 5",
    people: "2 adultos + 1 niño (hasta 6)",
    description:
      "Ideal para parejas o familia chica. Planta baja. No se aceptan mascotas.",
    details: {
      ambientes: "2",
      plantas: "Planta baja",
      banos: "1 baño",
      camas: "2 + futón",
      extra: "Máximo: 2 adultos + 1 niño de hasta 6 años",
    },
    highlights: ["Planta baja", "Parrilla privada", "Parque"],
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

// La portada es la primera foto: un video no sirve de portada porque en el
// celular no arranca solo. Si la casa sólo tiene videos, va el primero.
function portada(items) {
  return items.find((m) => !m.video) || items[0] || null;
}

// Una miniatura o portada de video: muestra el primer cuadro. El "#t=0.1" es
// para que Safari pinte ese cuadro en vez de dejar el recuadro en negro.
function CuadroVideo({ src, className }) {
  return (
    <video
      src={`${src}#t=0.1`}
      className={className}
      muted
      playsInline
      preload="metadata"
    />
  );
}

function useGaleria() {
  // null = todavía no se sabe; {} = se sabe y no hay cambios (o falló).
  const [galeria, setGaleria] = useState(null);

  useEffect(() => {
    let vivo = true;
    const listo = (g) => vivo && setGaleria((ya) => ya ?? g);
    const plazo = setTimeout(() => listo({}), ESPERA_GALERIA_MS);

    fetch("/api/house-gallery")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // Si llegó tarde, igual se usa: mejor cambiar tarde que nunca.
        if (vivo) setGaleria(d && d.ok && d.casas ? d.casas : {});
      })
      .catch(() => listo({}))
      .finally(() => clearTimeout(plazo));

    return () => {
      vivo = false;
      clearTimeout(plazo);
    };
  }, []);

  return galeria;
}

export default function HousesSection() {
  const galeria = useGaleria();

  // Cada casa con su lista de fotos y videos: { src, video }. El src ya va
  // codificado (los nombres de las originales tienen espacios y eñes).
  const houses = useMemo(
    () =>
      housesData.map((h) => {
        const crudas = galeria === null ? null : galeria[h.id] || originales(h.id);
        const media = crudas && crudas.map((m) => ({ src: encodeURI(m.src), video: Boolean(m.video) }));
        return { ...h, media };
      }),
    [galeria]
  );

  // Lightbox state (por casa)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeHouse, setActiveHouse] = useState(null); // { title, media }
  const [idx, setIdx] = useState(0);

  const images = activeHouse?.media || [];
  const current = images[idx];

  const openGallery = (house) => {
    if (!house?.media?.length) return; // no abre si no hay
    setActiveHouse({ title: house.title, media: house.media });
    setIdx(0);
    setLightboxOpen(true);
  };

  // useCallback para que los efectos de abajo puedan declararlos como
  // dependencia sin recrear los listeners en cada render.
  const close = useCallback(() => setLightboxOpen(false), []);

  const prev = useCallback(
    () => setIdx((i) => (i - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setIdx((i) => (i + 1) % images.length),
    [images.length]
  );

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
  }, [lightboxOpen, close, prev, next]);

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
  }, [lightboxOpen, prev, next]);

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
              Cinco casas en alquiler en Mar de Cobo, unidades independientes y
              equipadas para descansar a metros del mar.
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
            const cargando = h.media === null;
            const media = h.media || [];
            const hasPhotos = media.length > 0;
            const tapa = portada(media);
            // Las miniaturas son las que siguen, sin repetir la portada, con
            // su lugar real en la galería para abrirla ahí.
            const miniaturas = media
              .map((m, i) => ({ ...m, i }))
              .filter((m) => m !== tapa && m.src !== tapa?.src)
              .slice(0, 4);

            return (
              <div
                key={h.id}
                className="group bg-white rounded-[2.5rem] overflow-hidden shadow-2xl hover:shadow-brand-brown/10 transition-all duration-500 border border-transparent hover:border-brand-beige h-full flex flex-col"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-brand-beige/20">
                  {cargando ? (
                    <div className="w-full h-full animate-pulse bg-brand-beige/30" aria-hidden="true" />
                  ) : hasPhotos ? (
                    tapa.video ? (
                      <CuadroVideo
                        src={tapa.src}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                      />
                    ) : (
                      <img
                        src={tapa.src}
                        alt={`${h.title}, casa en alquiler en Mar de Cobo`}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        loading="lazy"
                      />
                    )
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
                      {[...COMMON.includes, ...(h.includesExtra || [])].map((t) => (
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
                        href="/reservar"
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

                    {miniaturas.length > 0 && (
                      <div className="mt-8 grid grid-cols-4 gap-3">
                        {miniaturas.map(({ src, video, i }) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() => {
                              setActiveHouse({ title: h.title, media });
                              setIdx(i);
                              setLightboxOpen(true);
                            }}
                            className="rounded-xl overflow-hidden border border-brand-beige/60 hover:scale-[1.03] transition-transform"
                            aria-label={`Abrir item ${i + 1} de ${h.title}`}
                          >
                            {video ? (
                              <div className="relative w-full h-full">
                                <CuadroVideo
                                  src={src}
                                  className="w-full h-full aspect-square object-cover"
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
                                alt={`${h.title} ${i + 1}`}
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
          className="fixed inset-0 z-[9999] bg-brand-cream/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Galería ${activeHouse.title}`}
        >
          <div className="w-full max-w-[95vw] sm:max-w-[92vw] xl:max-w-[1400px]">
            <div className="relative bg-white/85 rounded-3xl border border-brand-beige/70 overflow-hidden shadow-2xl">
              {/* top bar */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="text-brand-brown font-semibold serif italic">
                    {activeHouse.title}
                  </div>
                  <div className="text-brand-brown/60 text-xs font-black uppercase tracking-[0.22em]">
                    {idx + 1} / {images.length}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={close}
                  className="text-brand-brown/70 hover:text-brand-brown transition-colors text-2xl leading-none px-3 py-1 rounded-lg"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              {/* media */}
              <div
                className="relative w-full bg-brand-cream"
                style={{ height: "min(82vh, 760px)" }}
              >
                {current.video ? (
                  <video
                    key={current.src}
                    src={current.src}
                    className="w-full h-full object-contain select-none max-h-[82vh]"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={current.src}
                    alt={`${activeHouse.title} foto ${idx + 1}`}
                    className="w-full h-full object-contain select-none max-h-[82vh]"
                    draggable="false"
                  />
                )}

                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-brand-brown rounded-full w-12 h-12 flex items-center justify-center transition-colors shadow-lg border border-brand-beige/70"
                  aria-label="Anterior"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-brand-brown rounded-full w-12 h-12 flex items-center justify-center transition-colors shadow-lg border border-brand-beige/70"
                  aria-label="Siguiente"
                >
                  ›
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-white/90 to-transparent">
                  <div className="text-brand-brown/60 text-xs">
                    Tip: flechas ← → para navegar · ESC para cerrar
                  </div>
                </div>
              </div>
            </div>

            {/* thumbnails */}
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {images.map(({ src, video }, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`shrink-0 w-24 h-16 rounded-xl overflow-hidden border transition-all bg-white ${
                    i === idx
                      ? "border-brand-brown/40 shadow-sm"
                      : "border-brand-beige/60 hover:border-brand-brown/20"
                  }`}
                  aria-label={`Ir a item ${i + 1}`}
                >
                  {video ? (
                    <div className="relative w-full h-full">
                      <CuadroVideo src={src} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-brand-brown/60 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
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