"use client";
import { useState, useTransition } from "react";
import { compartilharWhatsAppAction, compartilharEmailAction } from "@/app/admin/jornadas/actions";

/** Botão(ões) de compartilhar uma entrega por link (copiar/WhatsApp/e-mail). Reutilizável (U3). */
export function Compartilhar({ orgId, url, titulo = "sua entrega", compact = false }: { orgId: string; url: string; titulo?: string; compact?: boolean }) {
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const copiar = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  const wa = () => start(async () => { const r = await compartilharWhatsAppAction(orgId, url, titulo); setMsg(r.ok ? { tone: "ok", text: "Enviado por WhatsApp ✓" } : { tone: "err", text: r.erro ?? "Falha." }); });
  const mail = () => start(async () => { const r = await compartilharEmailAction(orgId, url, titulo); setMsg(r.ok ? { tone: "ok", text: "Enviado por e-mail ✓" } : { tone: "err", text: r.erro ?? "Falha." }); });

  const btn = "ds-focus rounded-ds-input border border-hairline-strong px-2.5 py-1.5 font-montserrat text-[11.5px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)] disabled:opacity-50";
  return (
    <div className={compact ? "inline-flex flex-wrap items-center gap-1.5" : "flex flex-wrap items-center gap-2"}>
      <button type="button" onClick={copiar} className={btn}>{copied ? "copiado!" : "Copiar link"}</button>
      <button type="button" disabled={pending} onClick={wa} className={btn}>WhatsApp</button>
      <button type="button" disabled={pending} onClick={mail} className={btn}>E-mail</button>
      {msg && <span className={`font-montserrat text-[13px] ${msg.tone === "ok" ? "text-[color:var(--brand-deep)]" : "text-[#B42318]"}`}>{msg.text}</span>}
    </div>
  );
}
