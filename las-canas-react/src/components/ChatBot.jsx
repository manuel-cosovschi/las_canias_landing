import { useEffect, useRef, useState } from "react";

const CHAT_API = "/.netlify/functions/chat";

const WELCOME = {
  role: "assistant",
  content:
    "¡Hola! Soy Cañitas 🌾 Te puedo contar sobre las casas, la zona y cómo reservar en Las Cañas. ¿En qué te ayudo?",
};

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  async function sendMessage(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      // Solo mandamos el historial conversacional (sin el saludo inicial).
      const payload = nextMessages.filter((m) => m !== WELCOME);
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) {
        throw new Error(data.message || "No se pudo responder");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Uy, tuve un problema para responder 😕 Probá de nuevo en un momento o escribinos por WhatsApp al +54 223 688 2986.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-7 left-7 z-[60] bg-brand-brown text-brand-cream px-4 py-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-2 overflow-hidden max-w-[60px] hover:max-w-[240px] group"
        aria-label="Abrir chat con Cañitas"
      >
        <span className="text-2xl leading-none">🌾</span>
        <span className="whitespace-nowrap font-black text-[12px] pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Preguntale a Cañitas
        </span>
      </button>

      {/* Panel de chat */}
      {open && (
        <div className="fixed bottom-28 left-4 sm:left-7 z-[70] w-[calc(100vw-2rem)] sm:w-[380px] max-w-[380px] h-[70vh] max-h-[560px] bg-brand-cream rounded-2xl shadow-2xl border border-brand-beige flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-brand-brown text-brand-cream px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌾</span>
              <div className="leading-tight">
                <p className="font-bold text-sm">Cañitas</p>
                <p className="text-[11px] opacity-80">Asistente de Las Cañas</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-brand-cream/80 hover:text-white text-xl leading-none"
              aria-label="Cerrar chat"
            >
              ✕
            </button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-brand-brown text-brand-cream rounded-br-sm"
                      : "bg-white/80 text-brand-brown border border-brand-beige rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/80 text-brand-brown border border-brand-beige rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">·</span>
                    <span className="animate-bounce [animation-delay:150ms]">·</span>
                    <span className="animate-bounce [animation-delay:300ms]">·</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t border-brand-beige flex items-center gap-2 bg-brand-cream">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu consulta..."
              className="flex-1 border border-brand-beige rounded-full px-4 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-brand-brown text-brand-cream rounded-full w-10 h-10 flex items-center justify-center hover:opacity-90 transition disabled:opacity-40"
              aria-label="Enviar"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
