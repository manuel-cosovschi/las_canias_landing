export default function Gallery() {
  const images = [
    { src: "/entradaVista1.jpg", alt: "Entrada" },
    { src: "/portonEntrada.JPG", alt: "Portón" },
    { src: "/autosentrada.jpg", alt: "Estacionamiento" },
    { src: "/entradaVista1.jpg", alt: "Mar de Cobo" },
  ];

  return (
    <section id="gallery" className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 serif text-brand-brown">Postales del Complejo</h2>
          <p className="text-brand-brown/60 max-w-2xl mx-auto">
            Un vistazo a Las Cañas y a la tranquilidad de Mar de Cobo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {images.map((img, idx) => (
            <div key={idx} className="group relative overflow-hidden rounded-2xl aspect-square shadow-lg transition-all hover:shadow-2xl">
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                <p className="text-white font-medium">{img.alt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}