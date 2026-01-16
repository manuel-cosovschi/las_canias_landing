export default function Contact() {
  return (
    <section id="contact" className="py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto bg-stone-50 rounded-[3rem] p-8 md:p-16 shadow-inner flex flex-col lg:flex-row gap-16">
          <div className="w-full lg:w-1/3">
            <h2 className="text-4xl font-bold mb-6 italic serif text-brand-brown">¿Te gustaría visitarnos?</h2>
            <p className="text-brand-brown/60 mb-10 font-light">
              Escribinos tu consulta y te respondemos a la brevedad.
            </p>

            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">📞</div>
                <div>
                  <h4 className="font-bold text-brand-brown">Teléfono</h4>
                  <p className="text-brand-brown/60">+54 223 6882986</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">📍</div>
                <div>
                  <h4 className="font-bold text-brand-brown">Ubicación</h4>
                  <p className="text-brand-brown/60">Mar de Cobo, Buenos Aires, Argentina</p>
                </div>
              </div>

              <a
                href="https://wa.me/542236882986"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-3 bg-[#25D366] text-white px-6 py-4 rounded-2xl font-bold shadow-xl hover:scale-[1.02] transition-transform"
              >
                <span className="text-xl">💬</span> Consultar por WhatsApp
              </a>
            </div>
          </div>

          <div className="w-full lg:w-2/3">
            {/* Netlify form (sin backend) */}
            <form
              name="contacto"
              method="POST"
              data-netlify="true"
              netlify-honeypot="bot-field"
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <input type="hidden" name="form-name" value="contacto" />
              <p className="hidden">
                <label>
                  Si sos humano, dejá esto vacío: <input name="bot-field" />
                </label>
              </p>

              <div className="space-y-2">
                <label className="text-sm font-bold text-brand-brown ml-1">Nombre</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Tu nombre"
                  className="w-full px-6 py-4 bg-white border border-transparent rounded-2xl focus:border-brand-accent focus:outline-none transition-all shadow-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-brand-brown ml-1">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="ejemplo@correo.com"
                  className="w-full px-6 py-4 bg-white border border-transparent rounded-2xl focus:border-brand-accent focus:outline-none transition-all shadow-sm"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-brand-brown ml-1">Mensaje</label>
                <textarea
                  name="message"
                  placeholder="Contanos fechas tentativas, cantidad de personas y dudas..."
                  rows="5"
                  className="w-full px-6 py-4 bg-white border border-transparent rounded-2xl focus:border-brand-accent focus:outline-none transition-all shadow-sm resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="md:col-span-2 w-full py-5 bg-brand-brown hover:bg-black text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:shadow-2xl transition-all"
              >
                Enviar mensaje
              </button>
            </form>

            <p className="mt-6 text-xs text-brand-brown/50">
              Si preferís, también podés reservar directamente desde{" "}
              <a href="/reservar.html" className="underline font-bold">
                Reservar
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}