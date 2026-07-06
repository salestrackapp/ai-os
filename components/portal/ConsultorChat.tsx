"use client";
import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Resuma meu programa e a fase atual",
  "Qual é a minha próxima sessão?",
  "Que Receita do Playbook eu deveria começar hoje?",
  "Como uso o Claude para resumir um documento longo?",
];

export function ConsultorChat({ initialMessages, initialConversationId }: { initialMessages: Msg[]; initialConversationId: string | null }) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const res = await fetch("/api/consultor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: msg, conversationId }) });
      const data = await res.json();
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: data.text ?? "Não consegui responder agora." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Falha de conexão. Tente novamente." }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="card flex flex-col h-[calc(100vh-16rem)] min-h-[420px]">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted2 pt-8">
            <p className="font-serif text-xl text-cream mb-1">Olá! Sou o Consultor do seu Programa.</p>
            <p className="text-sm mb-6">Posso resumir seu andamento, lembrar suas sessões e guiar você pelas Receitas do Playbook.</p>
            <div className="grid sm:grid-cols-2 gap-2 max-w-xl mx-auto">
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-left text-sm bg-navy3 border border-line hover:border-goldline rounded-lg px-3 py-2 text-muted hover:text-cream transition-colors">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-gold text-white font-medium" : "bg-navy3 border border-line text-cream"}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="bg-navy3 border border-line rounded-2xl px-4 py-2.5 text-sm text-muted2">Consultando seu programa…</div></div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-line p-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} placeholder="Escreva sua pergunta sobre o programa…" className="input flex-1" />
        <button disabled={busy || !input.trim()} className="btn-gold disabled:opacity-50">Enviar</button>
      </form>
    </div>
  );
}
