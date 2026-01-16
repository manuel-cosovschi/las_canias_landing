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
              <li>
                <a href="https://wa.me/542236882986" target="_blank" rel="noreferrer" className="hover:text-brand-beige transition-colors">
                  WhatsApp
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