export default function FloatingWhatsApp() {
  return (
    <a
      href="https://wa.me/542236882986"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-7 right-7 z-[60] bg-[#25D366] text-white px-4 py-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all group flex items-center gap-2 overflow-hidden max-w-[60px] hover:max-w-[220px]"
      aria-label="WhatsApp"
    >
      <span className="text-2xl">💬</span>
      <span className="whitespace-nowrap font-black text-[12px] pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
        ¡Consultanos!
      </span>
    </a>
  );
}