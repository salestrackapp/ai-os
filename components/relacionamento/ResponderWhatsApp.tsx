"use client";
import { useState, useTransition } from "react";
import { responderWhatsAppAction } from "@/app/admin/relacionamento/actions";
import type { SendPolicy } from "@/lib/relacionamento/responder";

type Tpl = { id: string; nome: string; corpo: string; atalho: string | null; hsm: boolean };

/**
 * Compositor de WhatsApp (E4). Aplica as regras do canal no cliente (UX) — o servidor revalida:
 * - sem opt-in → bloqueia; dentro de 24h → texto livre; fora → só template HSM.
 */
export function ResponderWhatsApp({ conversaId, policy, templates, optIn, windowOpen }:
  { conversaId: string; policy: SendPolicy; templates: Tpl[]; optIn: boolean; windowOpen: boolean }) {
  const [corpo, setCorpo] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const hsmTemplates = templates.filter((t) => t.hsm);
  const rapidas = templates.filter((t) => !t.hsm);
  const soHsm = !windowOpen;  // fora da janela: só HSM
  const selTpl = templates.find((t) => t.id === templateId);

  const enviar = (modo: "enviar" | "rascunho") => {
    const fd = new FormData();
    if (templateId) fd.set("templateId", templateId); else fd.set("corpo", corpo);
    fd.set("modo", modo);
    if (!templateId && !corpo.trim()) { setMsg({ tone: "err", text: "Escreva uma mensagem ou escolha um template." }); return; }
    if (soHsm && !selTpl?.hsm) { setMsg({ tone: "err", text: "Fora da janela de 24h: escolha um template HSM aprovado." }); return; }
    start(async () => {
      const r = await responderWhatsAppAction(conversaId, fd);
      if (r.bloqueado) { setMsg({ tone: "err", text: r.erro ?? "Envio bloqueado pelas regras do canal." }); return; }
      if (!r.ok) { setMsg({ tone: "err", text: r.erro ?? "Erro ao enviar." }); return; }
      if (r.enviado) { setMsg({ tone: "ok", text: "Mensagem enviada pelo WhatsApp da Salestrack e registrada na timeline." }); setCorpo(""); setTemplateId(""); }
      else { setMsg({ tone: "warn", text: r.erro ?? "Enviado para a fila de aprovação — sai após um membro aprovar." }); setCorpo(""); setTemplateId(""); }
    });
  };

  const btn = "ds-focus rounded-ds-input px-4 h-10 font-montserrat text-sm font-semibold disabled:opacity-50";
  const envioDireto = policy === "direto_autorizado";

  if (!optIn) {
    return (
      <div className="border-t border-hairline bg-[#FDECEC] p-4">
        <p className="font-montserrat text-[13px] text-[#B42318]"><b>Sem consentimento (opt-in).</b> Não é permitido enviar mensagens para este contato. Registre o opt-in no contato do CRM para habilitar o envio.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-hairline p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-montserrat text-[13px] font-semibold text-[color:var(--fg-1)]">Responder no WhatsApp</p>
        <span className={`rounded-ds-pill px-2 py-0.5 font-montserrat text-[11px] ${windowOpen ? "bg-[var(--tile)] text-[color:var(--brand-deep)]" : "bg-[#FFF7E6] text-[color:var(--fg-2)]"}`}>{windowOpen ? "janela 24h aberta" : "janela 24h fechada · só HSM"}</span>
      </div>

      {/* templates */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {(soHsm ? hsmTemplates : templates).map((t) => (
          <button key={t.id} type="button" onClick={() => { setTemplateId(t.id); setCorpo(t.corpo); }}
            className={`ds-focus rounded-ds-pill border px-2.5 py-1 font-montserrat text-[11px] ${templateId === t.id ? "border-[color:var(--brand)] bg-[var(--tile)] text-[color:var(--brand-deep)]" : "border-hairline text-[color:var(--fg-2)] hover:border-[color:var(--brand-light)]"}`}>
            {t.hsm ? "🅷 " : ""}{t.nome}
          </button>
        ))}
        {templateId && <button type="button" onClick={() => { setTemplateId(""); setCorpo(""); }} className="ds-focus rounded-ds-pill border border-hairline px-2.5 py-1 font-montserrat text-[11px] text-[color:var(--fg-3)]">limpar</button>}
      </div>

      <textarea value={corpo} onChange={(e) => { setCorpo(e.target.value); if (templateId) setTemplateId(""); }} rows={4}
        disabled={soHsm && !!templateId && selTpl?.hsm}
        placeholder={soHsm ? "Fora da janela de 24h — escolha um template HSM acima." : "Escreva a mensagem… as variáveis do template são resolvidas no envio."}
        className="w-full rounded-ds-card border border-hairline bg-[var(--bg-1)] p-3 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)] disabled:bg-[var(--bg-2)]" />

      {selTpl?.hsm && <p className="mt-1 font-montserrat text-[11px] text-[color:var(--fg-3)]">Template HSM aprovado — permitido mesmo fora da janela de 24h.</p>}
      {rapidas.length > 0 && soHsm && <p className="mt-1 font-montserrat text-[11px] text-[color:var(--fg-3)]">Respostas rápidas ficam disponíveis quando a janela de 24h estiver aberta.</p>}

      {msg && <p className={`mt-2 rounded-ds-input px-3 py-2 font-montserrat text-[12px] ${msg.tone === "ok" ? "bg-[var(--tile)] text-[color:var(--brand-deep)]" : msg.tone === "warn" ? "bg-[#FFF7E6] text-[color:var(--fg-1)]" : "bg-[#FDECEC] text-[#B42318]"}`}>{msg.text}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button disabled={pending} onClick={() => enviar("enviar")} className={`${btn} bg-brand text-white shadow-ds-brand hover:bg-brand-hover`}>
          {pending ? "Processando…" : envioDireto ? "Enviar" : "Enviar para aprovação"}
        </button>
        {envioDireto && <button disabled={pending} onClick={() => enviar("rascunho")} className={`${btn} border border-hairline-strong bg-[var(--bg-1)] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]`}>Guardar como rascunho</button>}
        <span className="font-montserrat text-[11px] text-[color:var(--fg-3)]">{envioDireto ? "Gate: envio direto (sensíveis pedem aprovação)." : "Gate: toda mensagem passa por aprovação."}</span>
      </div>
    </div>
  );
}
