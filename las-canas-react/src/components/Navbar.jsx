import { useEffect, useRef, useState } from "react";
import { hayTienda } from "../data/tienda.js";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);

    const onDown = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener("mousedown", onDown);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  // ✅ Bloquear scroll cuando el menú mobile está abierto (evita bugs iOS/Safari)
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const links = [
    { name: "Inicio", href: "#home" },
    { name: "Quiénes Somos", href: "#about" },
    { name: "Nuestras Casas", href: "#casas" },
  ];

  // ✅ NO instagram acá
  // ✅ Términos va al HTML aparte
  const extra = [
    { name: "Galería", href: "#gallery" },
    { name: "Ubicación", href: "#location" },

    // ✅ NUEVO: después de Ubicación
    { name: "Tips y sugerencias", href: "/tips+sugerencias.html" },

    { name: "Contacto", href: "#contact" },
    { name: "Términos", href: "/terminos.html" },
  ];

  const linkClass = `flex items-center leading-none text-[11px] font-black tracking-[0.22em] uppercase hover:text-brand-accent transition-colors ${
    isScrolled ? "text-brand-brown" : "text-brand-brown md:text-white lg:text-brand-brown"
  }`;

  const closeAll = () => {
    setMobileOpen(false);
    setDropOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        isScrolled ? "bg-white/95 backdrop-blur-md shadow-md py-2" : "bg-transparent py-4"
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">
        {/* Brand */}
        <a
          href="#home"
          aria-label="Ir al inicio - Las Cañas"
          className="flex items-center gap-4 group"
          onClick={closeAll}
        >
          {/* ✅ Logo SIN fondo circular */}
          <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center overflow-hidden">
            <img
              src="/logo.PNG"
              alt="Las Cañas"
              className="w-full h-full object-contain logo-shadow block select-none"
              draggable="false"
              loading="eager"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.classList.add("flex", "items-center", "justify-center");
                  parent.innerHTML =
                    '<span class="serif font-bold text-brand-brown select-none">LC</span>';
                }
              }}
            />
          </div>

          <div className="flex flex-col">
            <span
              className={`text-xl font-bold tracking-tight leading-none serif ${
                isScrolled ? "text-brand-brown" : "text-brand-brown md:text-white lg:text-brand-brown"
              }`}
            >
              Las Cañas
            </span>
            <span
              className={`text-[9px] uppercase tracking-[0.3em] font-semibold mt-1 ${
                isScrolled ? "text-brand-accent" : "text-brand-accent md:text-brand-beige lg:text-brand-accent"
              }`}
            >
              Mar de Cobo
            </span>
          </div>
        </a>

        {/* Desktop */}
        <ul className="hidden lg:flex items-center space-x-10">
          {links.map((l) => (
            <li key={l.name} className="flex items-center">
              <a href={l.href} className={linkClass}>
                {l.name}
              </a>
            </li>
          ))}

          <li className="relative flex items-center" ref={dropRef}>
            <button
              onClick={() => setDropOpen((v) => !v)}
              className={`${linkClass} gap-2`}
              type="button"
            >
              Explorar{" "}
              <span className={`transition-transform duration-300 ${dropOpen ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>

            <div
              className={`absolute top-full right-0 mt-4 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 origin-top ${
                dropOpen
                  ? "scale-100 opacity-100 translate-y-0"
                  : "scale-95 opacity-0 -translate-y-2 pointer-events-none"
              }`}
            >
              {extra.map((it) => (
                <a
                  key={it.name}
                  href={it.href}
                  className="block px-6 py-4 text-[11px] font-black tracking-[0.22em] uppercase text-brand-brown hover:bg-brand-cream hover:text-brand-accent transition-colors border-b border-gray-100 last:border-b-0"
                  onClick={() => setDropOpen(false)}
                >
                  {it.name}
                </a>
              ))}

              <a
                href="/admin.html"
                className="block px-6 py-4 text-[11px] font-black tracking-[0.22em] uppercase text-brand-brown/60 hover:bg-brand-cream hover:text-brand-accent transition-colors"
                onClick={() => setDropOpen(false)}
              >
                Propietarios
              </a>
            </div>
          </li>

          {/* La tienda va antes de Reservar y en beige: se tiene que ver, pero
              reservar sigue siendo lo que paga las cuentas. Sin productos
              cargados no aparece. */}
          {hayTienda && (
            <li className="flex items-center">
              <a
                href="#tienda"
                className="bg-brand-beige hover:bg-brand-accent hover:text-brand-cream text-brand-brown px-8 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.24em] transition-all shadow-xl"
              >
                Tienda
              </a>
            </li>
          )}

          <li className="flex items-center">
            <a
              href="/reservar.html"
              className="bg-brand-brown hover:bg-black text-brand-cream px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.24em] transition-all shadow-xl hover:shadow-brand-brown/50"
            >
              Reservar
            </a>
          </li>
        </ul>

        {/* Mobile button */}
        <button
          className={`lg:hidden p-2 ${
            isScrolled ? "text-brand-brown" : "text-brand-brown md:text-white"
          }`}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          type="button"
        >
          <div
            className={`w-6 h-0.5 bg-current mb-1.5 transition-all ${
              mobileOpen ? "rotate-45 translate-y-2" : ""
            }`}
          />
          <div className={`w-6 h-0.5 bg-current mb-1.5 transition-all ${mobileOpen ? "opacity-0" : ""}`} />
          <div
            className={`w-6 h-0.5 bg-current transition-all ${
              mobileOpen ? "-rotate-45 -translate-y-2" : ""
            }`}
          />
        </button>
      </div>

      {/* ✅ Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[999] lg:hidden">
          <button
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
            type="button"
          />

          <div className="absolute top-0 left-0 right-0 bg-brand-cream border-b border-brand-beige/60 shadow-2xl">
            <div className="px-6 pt-5 pb-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="/logo.PNG"
                    alt="Las Cañas"
                    className="w-10 h-10 object-contain logo-shadow"
                    draggable="false"
                  />
                  <div className="leading-none">
                    <div className="serif text-lg font-bold text-brand-brown">Las Cañas</div>
                    <div className="text-[9px] uppercase tracking-[0.3em] font-semibold text-brand-accent mt-1">
                      Mar de Cobo
                    </div>
                  </div>
                </div>

                <button
                  className="p-3 rounded-2xl hover:bg-brand-beige/40 transition text-brand-brown"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Cerrar"
                  type="button"
                >
                  ✕
                </button>
              </div>

              <nav className="mt-7 flex flex-col gap-6 text-brand-brown">
                {links.map((l) => (
                  <a
                    key={l.name}
                    href={l.href}
                    className="serif text-3xl leading-none tracking-wide"
                    onClick={closeAll}
                  >
                    {l.name}
                  </a>
                ))}

                {extra.map((l) => (
                  <a
                    key={l.name}
                    href={l.href}
                    className="serif text-2xl leading-none tracking-wide text-brand-brown/90 hover:text-brand-accent transition-colors"
                    onClick={closeAll}
                  >
                    {l.name}
                  </a>
                ))}

                {hayTienda && (
                  <a
                    href="#tienda"
                    className="mt-2 inline-flex items-center justify-center bg-brand-beige hover:bg-brand-accent hover:text-brand-cream text-brand-brown px-10 py-5 rounded-full text-[10px] font-black uppercase tracking-[0.24em] transition-all shadow-xl"
                    onClick={closeAll}
                  >
                    Tienda de playa
                  </a>
                )}

                <a
                  href="/reservar.html"
                  className="mt-2 inline-flex items-center justify-center bg-brand-brown hover:bg-black text-brand-cream px-10 py-5 rounded-full text-[10px] font-black uppercase tracking-[0.24em] transition-all shadow-xl"
                  onClick={closeAll}
                >
                  Reservar ahora
                </a>

                <a
                  href="/admin.html"
                  className="text-xs font-black uppercase tracking-[0.22em] text-brand-brown/60 hover:text-brand-accent transition-colors"
                  onClick={closeAll}
                >
                  Acceso propietarios
                </a>
              </nav>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}