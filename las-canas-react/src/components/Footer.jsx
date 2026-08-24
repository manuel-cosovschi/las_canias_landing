// Fuera del componente: declarados adentro, React los tomaba como componentes
// nuevos en cada render y les reiniciaba el estado.
const IconWhatsApp = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M20.52 3.48A11.91 11.91 0 0 0 12.01 0C5.39 0 .01 5.38.01 12c0 2.11.55 4.17 1.6 5.98L0 24l6.18-1.62A11.94 11.94 0 0 0 12.01 24C18.63 24 24 18.62 24 12c0-3.2-1.25-6.21-3.48-8.52ZM12.01 22.02c-1.86 0-3.69-.5-5.28-1.45l-.38-.23-3.67.96.98-3.57-.25-.37A10 10 0 0 1 2 12C2 6.49 6.5 2 12.01 2c2.67 0 5.18 1.04 7.07 2.93A9.94 9.94 0 0 1 22.02 12c0 5.52-4.49 10.02-10.01 10.02Zm5.54-7.49c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.68-1.63-.93-2.24-.24-.58-.49-.5-.68-.51l-.58-.01c-.2 0-.53.08-.8.38-.27.3-1.05 1.03-1.05 2.51 0 1.48 1.08 2.9 1.23 3.1.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.72.64.72.23 1.37.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.07-.12-.27-.2-.57-.35Z" />
  </svg>
);

const IconInstagram = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm10.25 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="bg-brand-brown text-brand-cream py-14 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-beige/30 to-transparent" />

      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.PNG" alt="Las Cañas" className="w-10 h-10 object-contain logo-shadow" />
              <span className="text-2xl font-bold serif tracking-tight">Las Cañas</span>
            </div>
            <p className="text-brand-cream/70 text-sm leading-relaxed font-light italic">
              “Un refugio de paz para redescubrir la tranquilidad frente al mar.”
            </p>
          </div>

          <div>
            <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-5 text-brand-beige">Navegación</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li><a href="#home" className="hover:text-brand-beige transition-colors">Inicio</a></li>
              <li><a href="#about" className="hover:text-brand-beige transition-colors">Quiénes Somos</a></li>
              <li><a href="#casas" className="hover:text-brand-beige transition-colors">Nuestras Casas</a></li>
              <li><a href="#gallery" className="hover:text-brand-beige transition-colors">Galería</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-black text-xs uppercase tracking-[0.2em] mb-5 text-brand-beige">Gestión</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li>
                <a href="/admin.html" className="hover:text-brand-beige transition-colors">
                  Acceso propietarios
                </a>
              </li>

              <li>
                <a href="/reservar.html" className="hover:text-brand-beige transition-colors">
                  Reservar
                </a>
              </li>

              {/* ✅ WhatsApp con icono */}
              <li>
                <a
                  href="https://wa.me/542236882986"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:text-brand-beige transition-colors"
                >
                  <IconWhatsApp className="w-4 h-4 text-brand-cream/80" />
                  WhatsApp
                </a>
              </li>

              {/* ✅ Instagram con icono (debajo de WhatsApp) */}
              <li>
                <a
                  href="https://www.instagram.com/lascaniasmardecobo?igsh=a2htcW8zdmp1aGY5"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:text-brand-beige transition-colors"
                >
                  <IconInstagram className="w-4 h-4 text-brand-cream/80" />
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-brand-cream/15 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-brand-cream/40">
          <p>&copy; 2026 Las Cañas · Mar de Cobo</p>
          <p className="text-brand-cream/30">Hecho con ❤️</p>
        </div>
      </div>
    </footer>
  );
}