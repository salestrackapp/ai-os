"use client";
/**
 * Formulário público de Diagnóstico — Client Component.
 * Motivo: o form original (Server Action "silenciosa") não dava feedback durante o envio
 * e, como o formulário é longo, a confirmação (renderizada no topo) ficava fora da tela
 * depois de enviar — o cliente achava que o clique não tinha feito nada, mesmo tendo salvo.
 * Aqui: botão mostra "Enviando…"/"Salvando…" e trava durante o envio; ao concluir, rola até
 * a confirmação automaticamente.
 */
import { useActionState, useEffect, useRef, useState } from "react";
import { DIAGNOSTICO_SECOES } from "@/lib/diagnostico-schema";
import { salvarDiagnosticoAction, type SalvarState } from "@/app/diagnostico/[token]/actions";
import { botaoClasses } from "@/components/ds";

const inputCls = "w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 py-2.5 font-montserrat text-[14px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]";
const INITIAL_STATE: SalvarState = { at: 0, ok: true, enviado: false };

export function DiagnosticoForm({ token, dados, statusInicial }: {
  token: string; dados: Record<string, string>; statusInicial: "aberto" | "enviado";
}) {
  const action = salvarDiagnosticoAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const [clicado, setClicado] = useState<"enviar" | "rascunho" | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const jaSubmeteu = state.at > 0;
  const enviado = jaSubmeteu ? state.enviado : statusInicial === "enviado";
  const rascunhoSalvo = jaSubmeteu && state.ok && !state.enviado;
  const falhou = jaSubmeteu && !state.ok;

  // Rola até a confirmação só depois de um envio real — não no carregamento inicial da página.
  useEffect(() => {
    if (jaSubmeteu) bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.at]);

  return (
    <>
      {(enviado || rascunhoSalvo || falhou) && (
        <div
          ref={bannerRef}
          role="status"
          className={
            falhou
              ? "mt-4 rounded-ds-input border border-[color:var(--danger)] bg-[color:var(--danger)]/10 px-4 py-3 font-montserrat text-[14px] text-[color:var(--danger)]"
              : "mt-4 rounded-ds-input bg-[var(--tile)] px-4 py-3 font-montserrat text-[14px] text-[color:var(--brand-deep)]"
          }
        >
          {falhou
            ? "Não deu para salvar agora. Tente de novo — se continuar, fale com a Salestrack."
            : enviado
              ? <>✓ Diagnóstico <b>enviado</b>. Você ainda pode editar e reenviar se algo mudar. Obrigado!</>
              : "✓ Rascunho salvo. Pode fechar e voltar quando quiser — o link continua o mesmo."}
        </div>
      )}

      <form action={formAction} className="mt-6 space-y-8">
        {DIAGNOSTICO_SECOES.map((sec) => (
          <section key={sec.titulo}>
            <h2 className="font-montserrat text-[16px] font-semibold text-[color:var(--fg-1)]">{sec.titulo}</h2>
            {sec.descricao && <p className="mb-3 mt-0.5 font-montserrat text-[12.5px] text-[color:var(--fg-3)]">{sec.descricao}</p>}
            <div className="space-y-4">
              {sec.campos.map((c) => (
                <label key={c.id} className="block">
                  <span className="mb-1 block font-montserrat text-[14px] font-medium text-[color:var(--fg-2)]">{c.label}</span>
                  {c.tipo === "textarea"
                    ? <textarea name={c.id} defaultValue={dados[c.id] ?? ""} rows={4} placeholder={c.placeholder} className={inputCls} />
                    : <input name={c.id} defaultValue={dados[c.id] ?? ""} placeholder={c.placeholder} className={inputCls} />}
                  {c.help && <span className="mt-1 block font-montserrat text-[13px] text-[color:var(--fg-4)]">{c.help}</span>}
                </label>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-ds-input bg-[var(--bg-2)] px-4 py-3 font-montserrat text-[13px] text-[color:var(--fg-3)]">
          🔒 <b>Não peça senhas aqui.</b> Credenciais de acesso (domínio, redes, WhatsApp) serão coletadas em separado, por canal seguro, junto à equipe Salestrack.
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
          <button
            type="submit" name="acao" value="enviar" disabled={pending}
            onClick={() => setClicado("enviar")}
            className={botaoClasses({ size: "lg" })}
          >
            {pending && clicado === "enviar" ? "Enviando…" : "Enviar diagnóstico"}
          </button>
          <button
            type="submit" name="acao" value="rascunho" disabled={pending}
            onClick={() => setClicado("rascunho")}
            className="ds-focus inline-flex h-11 items-center rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-6 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && clicado === "rascunho" ? "Salvando…" : "Salvar rascunho"}
          </button>
          <span className="font-montserrat text-[13px] text-[color:var(--fg-4)]">Seus dados são tratados conforme a LGPD.</span>
        </div>
      </form>
    </>
  );
}
