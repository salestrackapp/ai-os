/** Formulário público de Diagnóstico (o cliente preenche via link com token). Standalone, v2 claro. */
import { SalestrackLogo } from "@/components/ds/SalestrackLogo";
import { getIntakeByToken, DIAGNOSTICO_SECOES } from "@/lib/diagnostico";
import { salvarDiagnosticoAction } from "./actions";

export const dynamic = "force-dynamic";

function Aviso({ msg }: { msg: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-2)] px-6">
      <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-10 text-center shadow-ds-card">
        <p className="ds-eyebrow">Salestrack AI</p>
        <h1 className="mt-2 font-montserrat text-2xl font-semibold text-[color:var(--fg-1)]">Formulário indisponível</h1>
        <p className="mt-2 font-montserrat text-sm text-[color:var(--fg-3)]">{msg}</p>
      </div>
    </main>
  );
}

export default async function DiagnosticoPublico({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const intake = await getIntakeByToken(token);
  if (!intake) return <Aviso msg="O link é inválido ou foi revogado. Fale com a Salestrack." />;

  const d = intake.dados ?? {};
  const enviado = intake.status === "enviado";
  const inputCls = "w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 py-2.5 font-montserrat text-[14px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]";

  return (
    <main className="min-h-screen bg-[var(--bg-2)] py-10">
      <div className="mx-auto max-w-3xl px-5">
        <header className="mb-6 flex items-center justify-between gap-4">
          <SalestrackLogo />
          <span className="rounded-ds-pill bg-[var(--tile)] px-3 py-1 font-montserrat text-[12px] font-semibold text-[color:var(--brand-deep)]">Diagnóstico Digital</span>
        </header>

        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-6 shadow-ds-card sm:p-8">
          <p className="ds-eyebrow">{intake.titulo}</p>
          <h1 className="mt-1 font-montserrat text-[26px] font-bold leading-tight text-[color:var(--fg-1)]">Conte pra gente sobre a operação</h1>
          <p className="mt-2 font-montserrat text-[14px] leading-relaxed text-[color:var(--fg-2)]">
            Estas informações alimentam o seu <b>site</b>, a <b>tabela de exames</b> e o <b>agente de IA no WhatsApp</b>. Pode salvar como rascunho e voltar depois — o link continua o mesmo.
          </p>

          {enviado && (
            <div className="mt-4 rounded-ds-input bg-[var(--tile)] px-4 py-3 font-montserrat text-[13px] text-[color:var(--brand-deep)]">
              ✓ Diagnóstico <b>enviado</b>. Você ainda pode editar e reenviar se algo mudar. Obrigado!
            </div>
          )}

          <form action={salvarDiagnosticoAction.bind(null, token)} className="mt-6 space-y-8">
            {DIAGNOSTICO_SECOES.map((sec) => (
              <section key={sec.titulo}>
                <h2 className="font-montserrat text-[16px] font-semibold text-[color:var(--fg-1)]">{sec.titulo}</h2>
                {sec.descricao && <p className="mb-3 mt-0.5 font-montserrat text-[12.5px] text-[color:var(--fg-3)]">{sec.descricao}</p>}
                <div className="space-y-4">
                  {sec.campos.map((c) => (
                    <label key={c.id} className="block">
                      <span className="mb-1 block font-montserrat text-[13px] font-medium text-[color:var(--fg-2)]">{c.label}</span>
                      {c.tipo === "textarea"
                        ? <textarea name={c.id} defaultValue={d[c.id] ?? ""} rows={4} placeholder={c.placeholder} className={inputCls} />
                        : <input name={c.id} defaultValue={d[c.id] ?? ""} placeholder={c.placeholder} className={inputCls} />}
                      {c.help && <span className="mt-1 block font-montserrat text-[11px] text-[color:var(--fg-4)]">{c.help}</span>}
                    </label>
                  ))}
                </div>
              </section>
            ))}

            <div className="rounded-ds-input bg-[var(--bg-2)] px-4 py-3 font-montserrat text-[12px] text-[color:var(--fg-3)]">
              🔒 <b>Não peça senhas aqui.</b> Credenciais de acesso (domínio, redes, WhatsApp) serão coletadas em separado, por canal seguro, junto à equipe Salestrack.
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
              <button name="acao" value="enviar" className="ds-focus inline-flex h-11 items-center rounded-ds-input bg-brand px-6 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Enviar diagnóstico</button>
              <button name="acao" value="rascunho" className="ds-focus inline-flex h-11 items-center rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-6 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Salvar rascunho</button>
              <span className="font-montserrat text-[11px] text-[color:var(--fg-4)]">Seus dados são tratados conforme a LGPD.</span>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center font-montserrat text-[11px] text-[color:var(--fg-4)]">Salestrack Inteligência Digital · Diagnóstico Digital</p>
      </div>
    </main>
  );
}
