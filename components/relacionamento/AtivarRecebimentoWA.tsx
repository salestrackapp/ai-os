"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ativarRecebimentoWhatsAppAction } from "@/app/admin/relacionamento/actions";

/** Botão que registra o webhook de recebimento do WhatsApp na Z-API (real-time push). */
export function AtivarRecebimentoWA() {
  const [res, setRes] = useState<{ ok: boolean; url?: string; erro?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const precisaToken = !!res?.erro && /client-?token/i.test(res.erro);

  const copiar = (t: string) => { navigator.clipboard?.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  return (
    <div className="mb-4 rounded-ds-card border border-hairline bg-[var(--bg-2)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-montserrat text-[13px] text-[color:var(--fg-1)]"><b>Recebimento automático (real-time).</b> Registra o webhook da Z-API para as mensagens caírem aqui sozinhas.</p>
        <button disabled={pending} onClick={() => start(async () => { setRes(await ativarRecebimentoWhatsAppAction()); })}
          className="ds-focus shrink-0 rounded-ds-input bg-brand px-4 h-10 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-50">
          {pending ? "Registrando…" : "Ativar recebimento"}
        </button>
      </div>

      {res?.ok && <p className="mt-2 break-all font-montserrat text-[12px] text-[color:var(--brand-deep)]">✓ Webhook registrado: {res.url}</p>}

      {res && !res.ok && (
        <div className="mt-2 rounded-ds-input bg-[#FDECEC] p-3">
          <p className="font-montserrat text-[12.5px] text-[#B42318]">{res.erro ?? "Falha ao registrar."}</p>
          {precisaToken && (
            <div className="mt-2 space-y-2 font-montserrat text-[12px] text-[color:var(--fg-1)]">
              <p><b>Como resolver (2 opções):</b></p>
              <p><b>A) Automático:</b> copie o <b>Client-Token</b> no painel da Z-API (Segurança / Token de segurança da conta) e cole em <Link href="/admin/configuracoes/parametros?cat=integracoes" className="text-[color:var(--brand)] underline">Configurações → Integrações → Z-API → Client-Token</Link>. Depois clique em <b>Ativar recebimento</b> de novo.</p>
              <p><b>B) Manual:</b> no painel da Z-API, em <b>Webhooks → Ao receber</b>, cole esta URL:</p>
              {res.url && (
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-[var(--bg-1)] px-2 py-1 font-jbmono text-[11px] text-[color:var(--fg-2)]">{res.url}</code>
                  <button onClick={() => copiar(res.url!)} className="ds-focus shrink-0 rounded-ds-input border border-hairline-strong px-2.5 py-1 text-[11px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">{copied ? "copiado!" : "copiar"}</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
