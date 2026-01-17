import { useEffect, useRef, useState } from "react";

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

  const links = [
    { name: "Inicio", href: "#home" },
    { name: "Quiénes Somos", href: "#about" },
    { name: "Nuestras Casas", href: "#casas" },
  ];

  const extra = [
    { name: "Galería", href: "#gallery" },
    { name: "Ubicación", href: "#location" },
    { name: "Contacto", href: "#contact" },
    { name: "Términos", href: "#terms" },
    { name: "Instagram", href: "https://www.instagram.com/lascaniasmardecobo?igsh=a2htcW8zdmp1aGY5", external: true },
  ];

  const linkClass = `text-[11px] font-black tracking-[0.22em] uppercase hover:text-brand-accent transition-colors ${
    isScrolled ? "text-brand-brown" : "text-brand-brown md:text-white lg:text-brand-brown"
  }`;

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        isScrolled ? "bg-white/95 backdrop-blur-md shadow-md py-2" : "bg-transparent py-4"
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">
        {/* Brand (con fondo para tapar el hero detrás) */}
        <a
          href="#home"
          className={`flex items-center gap-4 group rounded-full px-3 py-2 transition-all ${
            isScrolled
              ? "bg-white/80"
              : "bg-brand-cream/70 backdrop-blur-md shadow-sm border border-white/40"
          }`}
          onClick={() => setMobileOpen(false)}
        >
          <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
            <img src="/logo.PNG" alt="Las Cañas" className="w-full h-full object-contain logo-shadow" />
          </div>
          <div className="flex flex-col pr-2">
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
            <li key={l.name}>
              <a href={l.href} className={linkClass}>
                {l.name}
              </a>
            </li>
          ))}

          <li className="relative" ref={dropRef}>
            <button
              onClick={() => setDropOpen((v) => !v)}
              className={`${linkClass} flex items-center gap-2`}
              type="button"
            >
              Explorar <span className={`transition-transform duration-300 ${dropOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            <div
              className={`absolute top-full right-0 mt-4 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 origin-top ${
                dropOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 -translate-y-2 pointer-events-none"
              }`}
            >
              {extra.map((it) =>
                it.external ? (
                  <a
                    key={it.name}
                    href={it.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block px-6 py-4 text-[11px] font-black tracking-[0.22em] uppercase text-brand-brown hover:bg-brand-cream hover:text-brand-accent transition-colors border-b border-gray-50 last:border-0"
                    onClick={() => setDropOpen(false)}
                  >
                    {it.name}
                  </a>
                ) : (
                  <a
                    key={it.name}
                    href={it.href}
                    className="block px-6 py-4 text-[11px] font-black tracking-[0.22em] uppercase text-brand-brown hover:bg-brand-cream hover:text-brand-accent transition-colors border-b border-gray-50 last:border-0"
                    onClick={() => setDropOpen(false)}
                  >
                    {it.name}
                  </a>
                )
              )}

              <a
                href="/admin.html"
                className="block px-6 py-4 text-[11px] font-black tracking-[0.22em] uppercase text-brand-brown/60 hover:bg-brand-cream hover:text-brand-accent transition-colors"
                onClick={() => setDropOpen(false)}
              >
                Propietarios
              </a>
            </div>
          </li>

          <li>
            <a
              href="/reservar.html"
              className="bg-brand-brown hover:bg-black text-brand-cream px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.24em] transition-all shadow-xl hover:shadow-brand-brown/30"
            >
              Reservar
            </a>
          </li>
        </ul>

        {/* Mobile button */}
        <button
          className="lg:hidden p-2 text-brand-brown"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Abrir menú"
          type="button"
        >
          <div className={`w-6 h-0.5 bg-current mb-1.5 transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
          <div className={`w-6 h-0.5 bg-current mb-1.5 transition-all ${mobileOpen ? "opacity-0" : ""}`} />
          <div className={`w-6 h-0.5 bg-current transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-brand-cream z-40 flex flex-col items-center justify-center space-y-8 transition-transform duration-700 ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button className="absolute top-6 right-6 p-4 text-4xl text-brand-brown" onClick={() => setMobileOpen(false)} type="button">
          &times;
        </button>

        <div className="w-24 h-24 mb-2">
          <img src="/logo.PNG" alt="Logo" className="w-full h-full object-contain" />
        </div>

        {[...links, ...extra.filter((e) => !e.external)].map((l) => (
          <a
            key={l.name}
            href={l.href}
            className="text-2xl font-bold text-brand-brown serif tracking-wider hover:text-brand-accent transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            {l.name}
          </a>
        ))}

        <a
          href="https://www.instagram.com/lascaniasmardecobo?igsh=a2htcW8zdmp1aGY5"
          target="_blank"
          rel="noreferrer"
          className="text-lg font-bold text-brand-brown serif tracking-wider hover:text-brand-accent transition-colors"
          onClick={() => setMobileOpen(false)}
        >
          Instagram
        </a>

        <a
          href="/reservar.html"
          className="bg-brand-brown text-brand-cream px-12 py-5 rounded-full text-sm font-black uppercase tracking-widest shadow-2xl mt-6"
          onClick={() => setMobileOpen(false)}
        >
          Reservar ahora
        </a>

        <a
          href="/admin.html"
          className="text-xs font-black uppercase tracking-[0.22em] text-brand-brown/60 hover:text-brand-accent"
          onClick={() => setMobileOpen(false)}
        >
          Acceso propietarios
        </a>
      </div>
    </nav>
  );
}