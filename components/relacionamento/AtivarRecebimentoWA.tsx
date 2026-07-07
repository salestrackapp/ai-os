"use client";
import { useState, useTransition } from "react";
import { ativarRecebimentoWhatsAppAction } from "@/app/admin/relacionamento/actions";

/** Botão que registra o webhook de recebimento do WhatsApp na Z-API (real-time push). */
export function AtivarRecebimentoWA() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mb-4 rounded-ds-card border border-hairline bg-[var(--bg-2)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-montserrat text-[13px] text-[color:var(--fg-1)]"><b>Recebimento automático (real-time).</b> Registra o webhook da Z-API para as mensagens caírem aqui sozinhas.</p>
        <button disabled={pending} onClick={() => start(async () => {
          const r = await ativarRecebimentoWhatsAppAction();
          setMsg({ ok: r.ok, text: r.ok ? `Webhook registrado: ${r.url}` : (r.erro ?? "Falha ao registrar.") });
        })} className="ds-focus shrink-0 rounded-ds-input bg-brand px-4 h-10 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-50">
          {pending ? "Registrando…" : "Ativar recebimento"}
        </button>
      </div>
      {msg && <p className={`mt-2 break-all font-montserrat text-[12px] ${msg.ok ? "text-[color:var(--brand-deep)]" : "text-[#B42318]"}`}>{msg.text}</p>}
    </div>
  );
}
