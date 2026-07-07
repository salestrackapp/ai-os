"use client";
import { useState, useTransition } from "react";
import { responderAction } from "@/app/admin/relacionamento/actions";
import type { SendPolicy } from "@/lib/relacionamento/responder";

type Tpl = { id: string; nome: string; corpo: string; atalho: string | null };

/** Renderiza {{nome}}/{{assunto}} no cliente ao inserir um template. */
function render(corpo: string, nome: string, assunto: string) {
  return corpo.replace(/\{\{\s*nome\s*\}\}/gi, nome).replace(/\{\{\s*assunto\s*\}\}/gi, assunto);
}

export function Responder({ conversaId, policy, templates, contatoNome, assunto, sugestao }:
  { conversaId: string; policy: SendPolicy; templates: Tpl[]; contatoNome: string; assunto: string; sugestao?: string }) {
  const [corpo, setCorpo] = useState(sugestao ?? "");
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const enviar = (modo: "enviar" | "rascunho") => {
    if (!corpo.trim()) { setMsg({ tone: "err", text: "Escreva uma resposta antes." }); return; }
    const fd = new FormData();
    fd.set("corpo", corpo);
    fd.set("modo", modo);
    start(async () => {
      const r = await responderAction(conversaId, fd);
      if (!r.ok) { setMsg({ tone: "err", text: r.erro ?? "Erro ao responder." }); return; }
      if (r.enviado) { setMsg({ tone: "ok", text: "Resposta enviada pelo Gmail da Salestrack e registrada na timeline." }); setCorpo(""); }
      else { setMsg({ tone: "warn", text: r.erro ?? "Enviado para a fila de aprovação — sai após um membro aprovar." }); setCorpo(""); }
    });
  };

  const btn = "ds-focus rounded-ds-input px-4 h-10 font-montserrat text-sm font-semibold disabled:opacity-50";
  const envioDireto = policy === "direto_autorizado";

  return (
    <div className="border-t border-hairline p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-montserrat text-[13px] font-semibold text-[color:var(--fg-1)]">Responder</p>
        {templates.length > 0 && (
          <select
            aria-label="Inserir template"
            defaultValue=""
            onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setCorpo((c) => (c ? c + "\n\n" : "") + render(t.corpo, contatoNome, assunto)); e.target.value = ""; }}
            className="h-9 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-2 font-montserrat text-[12px] text-[color:var(--fg-2)]">
            <option value="" disabled>Inserir template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.atalho ? ` (${t.atalho})` : ""}</option>)}
          </select>
        )}
      </div>

      <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={5}
        placeholder="Escreva a resposta… a assinatura da equipe é anexada automaticamente."
        className="w-full rounded-ds-card border border-hairline bg-[var(--bg-1)] p-3 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />

      {msg && (
        <p className={`mt-2 rounded-ds-input px-3 py-2 font-montserrat text-[12px] ${msg.tone === "ok" ? "bg-[var(--tile)] text-[color:var(--brand-deep)]" : msg.tone === "warn" ? "bg-[color:var(--warn-tint,#FFF7E6)] text-[color:var(--fg-1)]" : "bg-[#FDECEC] text-[#B42318]"}`}>{msg.text}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button disabled={pending} onClick={() => enviar("enviar")} className={`${btn} bg-brand text-white shadow-ds-brand hover:bg-brand-hover`}>
          {pending ? "Processando…" : envioDireto ? "Enviar" : "Enviar para aprovação"}
        </button>
        {envioDireto && (
          <button disabled={pending} onClick={() => enviar("rascunho")} className={`${btn} border border-hairline-strong bg-[var(--bg-1)] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]`}>
            Guardar como rascunho
          </button>
        )}
        <span className="font-montserrat text-[11px] text-[color:var(--fg-3)]">
          {envioDireto ? "Gate: envio direto (assuntos sensíveis ainda pedem aprovação)." : "Gate: toda resposta passa por aprovação."}
        </span>
      </div>
    </div>
  );
}
