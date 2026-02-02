import { useEffect, useMemo, useState } from "react";

export default function Gallery() {
  const images = useMemo(
    () => [
      // ✅ IMÁGENES (carpeta: /public/Imagenes Postales/)
      { src: "/Imagenes Postales/entradaVista1.jpg", alt: "Entrada" },
      { src: "/Imagenes Postales/portonEntrada.JPG", alt: "Portón de entrada" },
      { src: "/Imagenes Postales/autos1.JPG", alt: "Estacionamiento" },
      { src: "/Imagenes Postales/IMG_5916 2.jpeg", alt: "Postal" },
      { src: "/Imagenes Postales/IMG_6013.jpeg", alt: "Postal" },
      { src: "/Imagenes Postales/IMG_6017.jpeg", alt: "Postal" },
      { src: "/Imagenes Postales/IMG_6038.jpeg", alt: "Postal" },
      { src: "/Imagenes Postales/IMG_6055.jpeg", alt: "Postal" },
      { src: "/Imagenes Postales/IMG_6057.jpeg", alt: "Postal" },

      // ✅ VIDEOS (carpeta: /public/Imagenes Postales/)
      { src: "/Imagenes Postales/IMG_4104.MOV", alt: "" },
      { src: "/Imagenes Postales/IMG_4108.MOV", alt: "" },
      { src: "/Imagenes Postales/IMG_4112.MOV", alt: "" },
      { src: "/Imagenes Postales/IMG_4133.MOV", alt: "" },
      { src: "/Imagenes Postales/IMG_4249.mov", alt: "" },
      { src: "/Imagenes Postales/IMG_4593.MOV", alt: "" },
      { src: "/Imagenes Postales/IMG_4863.MOV", alt: "" },
      { src: "/Imagenes Postales/IMG_5496.MOV", alt: "" },
      { src: "/Imagenes Postales/IMG_5601.MOV", alt: "" },
    ],
    []
  );

  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const current = images[idx];

  const isVideo = (src) => {
    const s = String(src || "").toLowerCase();
    return s.endsWith(".mp4") || s.endsWith(".mov") || s.includes(".mp4?") || s.includes(".mov?");
  };

  const openAt = (i) => {
    setIdx(i);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  // ✅ teclado: ESC cierra, flechas navegan
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);

  // ✅ swipe básico (mobile)
  useEffect(() => {
    if (!open) return;

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
  }, [open, images.length]);

  return (
    <section id="gallery" className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 serif text-brand-brown">
            Postales del Complejo
          </h2>
          <p className="text-brand-brown/60 max-w-2xl mx-auto">
            Un vistazo a Las Cañas y a la tranquilidad de Mar de Cobo.
          </p>
        </div>

        {/* ✅ Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {images.map((item, i) => {
            const video = isVideo(item.src);

            return (
              <button
                key={i}
                type="button"
                onClick={() => openAt(i)}
                className="group relative overflow-hidden rounded-2xl aspect-square shadow-lg transition-all hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-brand-beige"
                aria-label={`Ver: ${item.alt}`}
              >
                {video ? (
                  <div className="relative w-full h-full">
                    <video
                      src={item.src}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                      <p className="text-white font-medium">{item.alt}</p>
                    </div>
                    <div className="absolute top-4 right-4 bg-white/85 backdrop-blur px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-brand-brown opacity-0 group-hover:opacity-100 transition-opacity">
                      Video
                    </div>
                  </div>
                ) : (
                  <>
                    <img
                      src={item.src}
                      alt={item.alt}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                      <p className="text-white font-medium">{item.alt}</p>
                    </div>

                    {/* hint */}
                    <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-brand-brown opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ✅ Lightbox */}
      {open && current && (
        <div
          className="fixed inset-0 z-[9999] bg-brand-cream/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          onMouseDown={(e) => {
            // click afuera cierra
            if (e.target === e.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Galería - ampliada"
        >
          <div className="w-full max-w-[95vw] sm:max-w-[92vw] xl:max-w-[1400px]">
            <div className="relative bg-white/85 rounded-3xl border border-brand-beige/70 overflow-hidden shadow-2xl">
              {/* top bar */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="text-brand-brown/60 text-xs font-black uppercase tracking-[0.22em]">
                  {idx + 1} / {images.length}
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
                {isVideo(current.src) ? (
                  <video
                    src={current.src}
                    className="w-full h-full object-contain select-none max-h-[82vh]"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={current.src}
                    alt={current.alt}
                    className="w-full h-full object-contain select-none max-h-[82vh]"
                    draggable="false"
                  />
                )}

                {/* nav buttons */}
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

                {/* caption */}
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-white/90 to-transparent">
                  <div className="text-brand-brown font-medium">{current.alt}</div>
                  <div className="text-brand-brown/60 text-xs mt-1">
                    Tip: flechas ← → para navegar · ESC para cerrar
                  </div>
                </div>
              </div>
            </div>

            {/* thumbnails */}
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {images.map((im, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`shrink-0 w-24 h-16 rounded-xl overflow-hidden border transition-all bg-white ${
                    i === idx
                      ? "border-brand-brown/40 shadow-sm"
                      : "border-brand-beige/60 hover:border-brand-brown/20"
                  }`}
                  aria-label={`Ir a: ${im.alt}`}
                >
                  {isVideo(im.src) ? (
                    <div className="relative w-full h-full">
                      <video
                        src={im.src}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-brand-brown/60 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
                          Video
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={im.src}
                      alt={im.alt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
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