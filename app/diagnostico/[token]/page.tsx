/** Formulário público de Diagnóstico (o cliente preenche via link com token). Standalone, v2 claro. */
import { SalestrackLogo } from "@/components/ds/SalestrackLogo";
import { getIntakeByToken } from "@/lib/diagnostico";
import { DiagnosticoForm } from "@/components/diagnostico/DiagnosticoForm";

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

  return (
    <main className="min-h-screen bg-[var(--bg-2)] py-10">
      <div className="mx-auto max-w-3xl px-5">
        <header className="mb-6 flex items-center justify-between gap-4">
          <SalestrackLogo />
          <span className="rounded-ds-pill bg-[var(--tile)] px-3 py-1 font-montserrat text-[13px] font-semibold text-[color:var(--brand-deep)]">Diagnóstico Digital</span>
        </header>

        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-6 shadow-ds-card sm:p-8">
          <p className="ds-eyebrow">{intake.titulo}</p>
          <h1 className="mt-1 font-montserrat text-[24px] font-bold leading-tight text-[color:var(--fg-1)]">Conte pra gente sobre a operação</h1>
          <p className="mt-2 font-montserrat text-[14px] leading-relaxed text-[color:var(--fg-2)]">
            Estas informações alimentam o seu <b>site</b>, a <b>tabela de exames</b> e o <b>agente de IA no WhatsApp</b>. Pode salvar como rascunho e voltar depois — o link continua o mesmo.
          </p>

          <DiagnosticoForm token={token} dados={d} statusInicial={intake.status} />
        </div>

        <p className="mt-6 text-center font-montserrat text-[13px] text-[color:var(--fg-4)]">Salestrack Inteligência Digital · Diagnóstico Digital</p>
      </div>
    </main>
  );
}
