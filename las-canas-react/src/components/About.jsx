export default function About() {
  return (
    <section id="about" className="py-24 bg-stone-50">
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 relative">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500">
              <img
                src="/portada.jpeg"
                alt="Las Cañas"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-brand-beige/40 rounded-2xl -z-10" />
          </div>

          <div className="w-full lg:w-1/2">
            <span className="text-brand-accent font-bold tracking-widest uppercase text-sm mb-4 block">
              Nuestra historia
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-8 text-brand-brown leading-tight serif">
              Ana y Gonzalo: <br />
              anfitriones por pasión
            </h2>

            <div className="space-y-6 text-lg text-brand-brown/70 leading-relaxed font-light">
                <p>
                    Hoy les queremos contar quiénes somos… Desde chicos, y sin conocernos, ambos
                    sentimos que{" "}
                    <span className="text-brand-brown font-medium">Mar de Cobo</span> era nuestro
                    lugar en el mundo.
                </p>

                <p>
                    <span className="text-brand-brown font-medium">Las Cañas</span> comenzó como
                    un sueño que se hizo realidad hace{" "}
                    <span className="italic font-medium">más de 10 años</span>.
                </p>

                <p>
                    Hoy tenemos{" "}
                    <span className="text-brand-brown font-medium">5 casas</span> y estamos
                    orgullosos de todo lo construido en este camino recorrido, siempre buscando
                    seguir mejorando.
                </p>

                <p>
                    Cuando vienen a{" "}
                    <span className="text-brand-brown font-medium">Las Cañas</span> tratamos de
                    transmitirles la belleza de este lugar y deseamos que se lleven la sensación
                    de plenitud y bienestar que sentimos nosotros estando acá…
                </p>

                <p className="text-brand-brown font-semibold serif italic">
                    ¡Sean bienvenidos!
                </p>
            </div>

            <div className="mt-10 flex items-center gap-6">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4].map((i) => (
                  <img
                    key={i}
                    src={`https://picsum.photos/seed/${i + 20}/100/100`}
                    className="w-12 h-12 rounded-full border-2 border-white object-cover"
                    alt="Huéspedes"
                  />
                ))}
              </div>
              <p className="text-sm text-brand-brown/60 font-medium">Huéspedes felices cada temporada</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}