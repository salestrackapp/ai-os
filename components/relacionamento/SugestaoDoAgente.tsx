"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirSugestaoAction } from "@/app/admin/relacionamento/actions";

/**
 * O rascunho que o agente escreveu, dentro da conversa.
 *
 * Fica sempre EDITÁVEL e nunca envia sozinho. O texto começa preenchido porque o trabalho que se
 * quer poupar é o de escrever do zero — não o de decidir o que sai.
 */
export function SugestaoDoAgente({ id, conversaId, texto, quando }:
  { id: string; conversaId: string; texto: string; quando: string }) {
  const [corpo, setCorpo] = useState(texto);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [feito, setFeito] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const editado = corpo.trim() !== texto.trim();

  const decidir = (descartar: boolean) => start(async () => {
    const r = await decidirSugestaoAction(id, conversaId, corpo, descartar);
    if (!r.ok) { setMsg({ tone: "err", text: r.erro ?? "Não deu para concluir." }); return; }
    setFeito(true);
    setMsg(descartar
      ? { tone: "warn", text: "Rascunho descartado. Nada foi enviado." }
      : r.enviado
        ? { tone: "ok", text: "Mensagem enviada e registrada na conversa." }
        : { tone: "warn", text: "Foi para a fila de aprovação — sai depois que alguém aprovar." });
    router.refresh();
  });

  if (feito) {
    return (
      <div className="border-t border-hairline bg-[var(--bg-2)] px-4 py-3">
        <p className={`font-montserrat text-[13px] ${msg?.tone === "ok" ? "text-[color:var(--brand-deep)]" : "text-[color:var(--fg-2)]"}`}>{msg?.text}</p>
      </div>
    );
  }

  const btn = "ds-focus rounded-ds-input px-4 h-10 font-montserrat text-sm font-semibold disabled:opacity-50";

  return (
    <div className="border-t border-hairline bg-[var(--tile)] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-montserrat text-[14px] font-semibold text-[color:var(--brand-deep)]">
          Resposta preparada pelo agente
        </p>
        <span className="font-jbmono text-[11px] text-[color:var(--fg-4)]">
          {new Date(quando).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="ds-small !mt-0 mb-2">Leia, ajuste o que quiser e envie. Nada sai daqui sozinho.</p>

      <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={5}
        className="w-full rounded-ds-card border border-[color:var(--brand-light)] bg-[var(--bg-1)] p-3 font-montserrat text-[14px] leading-relaxed text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand)]" />

      {msg && <p className={`mt-2 rounded-ds-input px-3 py-2 font-montserrat text-[13px] ${msg.tone === "ok" ? "bg-[var(--tile)] text-[color:var(--brand-deep)]" : msg.tone === "warn" ? "bg-[#FFF7E6] text-[color:var(--fg-1)]" : "bg-[#FDECEC] text-[#B42318]"}`}>{msg.text}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button disabled={pending} onClick={() => decidir(false)} className={`${btn} bg-brand text-white shadow-ds-brand hover:bg-brand-hover`}>
          {pending ? "Processando…" : editado ? "Enviar com minhas mudanças" : "Enviar como está"}
        </button>
        <button disabled={pending} onClick={() => decidir(true)}
          className="ds-focus h-10 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)] disabled:opacity-50">
          Descartar
        </button>
        {editado && <span className="font-montserrat text-[13px] text-[color:var(--fg-3)]">Você editou o texto — guardamos as duas versões.</span>}
      </div>
    </div>
  );
}
