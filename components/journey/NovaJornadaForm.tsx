"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { criarJornadaAction, enviarDiagWhatsAppAction, enviarDiagEmailAction } from "@/app/admin/jornadas/actions";

const input = "h-11 w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[14px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]";
const lbl = "mb-1 block font-montserrat text-[13px] font-medium text-[color:var(--fg-2)]";

export function NovaJornadaForm({ ofertas }: { ofertas: string[] }) {
  const [done, setDone] = useState<{ orgId: string; token: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [envio, setEnvio] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, startSend] = useTransition();

  const link = done ? `${typeof window !== "undefined" ? window.location.origin : ""}/diagnostico/${done.token}` : "";

  if (done) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-ds-card border border-[color:var(--brand-light)] bg-[var(--tile)] p-6 text-center">
          <p className="font-montserrat text-[15px] font-semibold text-[color:var(--brand-deep)]">✓ Jornada criada</p>
          <p className="mt-1 font-montserrat text-[13px] text-[color:var(--fg-2)]">Cliente, oportunidade e diagnóstico prontos. Envie o link abaixo para começar.</p>
        </div>
        <div className="mt-4 rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4">
          <p className={lbl}>Link do diagnóstico</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-ds-input border border-hairline bg-[var(--bg-2)] px-3 py-2.5 font-jbmono text-[12px] text-[color:var(--fg-2)]">{link}</code>
            <button onClick={() => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
              className="ds-focus shrink-0 rounded-ds-input border border-hairline-strong px-3 h-10 font-montserrat text-sm text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">{copied ? "copiado!" : "copiar"}</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={sending} onClick={() => startSend(async () => { const r = await enviarDiagWhatsAppAction(done.orgId, done.token); setEnvio(r.ok ? { tone: "ok", text: "Enviado por WhatsApp ✓" } : { tone: "err", text: r.erro ?? "Falha no WhatsApp." }); })}
              className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-50">Enviar por WhatsApp</button>
            <button disabled={sending} onClick={() => startSend(async () => { const r = await enviarDiagEmailAction(done.orgId, done.token); setEnvio(r.ok ? { tone: "ok", text: "Enviado por e-mail ✓" } : { tone: "err", text: r.erro ?? "Falha no e-mail." }); })}
              className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Enviar por e-mail</button>
            <a href={link} target="_blank" rel="noopener noreferrer" className="ds-focus inline-flex h-10 items-center rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Ver formulário</a>
          </div>
          {envio && <p className={`mt-2 font-montserrat text-[12px] ${envio.tone === "ok" ? "text-[color:var(--brand-deep)]" : "text-[#B42318]"}`}>{envio.text}</p>}
        </div>
        <div className="mt-4 flex gap-2">
          <Link href={`/admin/clientes/${done.orgId}`} className="ds-focus inline-flex h-11 items-center rounded-ds-input bg-brand px-5 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Abrir a jornada</Link>
          <button onClick={() => { setDone(null); setEnvio(null); }} className="ds-focus inline-flex h-11 items-center rounded-ds-input border border-hairline-strong px-5 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Criar outra</button>
        </div>
      </div>
    );
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await criarJornadaAction(fd);
      if (!r.ok || !r.orgId || !r.token) { setErro(r.erro ?? "Não foi possível criar."); return; }
      setDone({ orgId: r.orgId, token: r.token });
    });
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
      <div>
        <label className={lbl} htmlFor="empresa">Empresa *</label>
        <input id="empresa" name="empresa" required placeholder="Ex.: Clínica Vitalis" className={input} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label className={lbl} htmlFor="contato">Contato *</label><input id="contato" name="contato" required placeholder="Nome de quem fala com a gente" className={input} /></div>
        <div><label className={lbl} htmlFor="cnpj">CNPJ <span className="text-[color:var(--fg-4)]">(opcional)</span></label><input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" className={input} /></div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label className={lbl} htmlFor="whatsapp">WhatsApp</label><input id="whatsapp" name="whatsapp" placeholder="(11) 90000-0000" className={input} /></div>
        <div><label className={lbl} htmlFor="email">E-mail</label><input id="email" name="email" type="email" placeholder="contato@empresa.com" className={input} /></div>
      </div>
      <p className="-mt-2 font-montserrat text-[11px] text-[color:var(--fg-4)]">Informe pelo menos um: WhatsApp ou e-mail (para enviar o diagnóstico).</p>
      <div>
        <label className={lbl} htmlFor="oferta">Oferta</label>
        <select id="oferta" name="oferta" defaultValue={ofertas[0]} className={input}>
          {ofertas.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {erro && <p className="rounded-ds-input bg-[#FDECEC] px-3 py-2 font-montserrat text-[13px] text-[#B42318]">{erro}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button disabled={pending} className="ds-focus inline-flex h-11 items-center rounded-ds-input bg-brand px-6 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-50">{pending ? "Criando…" : "Criar jornada"}</button>
        <span className="font-montserrat text-[11px] text-[color:var(--fg-4)]">Cria empresa + contato + oportunidade + diagnóstico. Contrato e proposta entram depois, dentro da jornada.</span>
      </div>
    </form>
  );
}
