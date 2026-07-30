import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { acessoRh, rhClient, rhConfigurado } from "@/lib/rh/client";
import { Pessoal, type PessoaLinha, type AusenciaLinha } from "@/components/admin/Pessoal";

export const dynamic = "force-dynamic";

export default async function RhPage() {
  const acesso = await acessoRh();

  /**
   * A recusa é explicada, não genérica. "Sem acesso" faz a pessoa abrir um chamado; dizer que o
   * acesso ao RH é concedido no próprio banco de RH resolve a dúvida na hora — e reforça, para
   * quem lê, que ser admin do AI OS não abre esta porta.
   */
  if (!acesso.permitido) {
    return (
      <ContentArea>
        <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "RH" }]} className="mb-4" />
        <PageHeader eyebrow="RH" title="Pessoas" subtitle="Dados de pessoal da Salestrack." />
        <Card>
          <p className="ds-body">{acesso.motivo}</p>
          {!rhConfigurado() && (
            <p className="ds-small mt-3">
              O banco de RH existe (projeto <b>salestrack-rh</b>, em São Paulo), mas o AI OS ainda
              não tem as credenciais para falar com ele. O passo a passo está em
              <b> docs/CONFIG_PENDENTE.md</b>, no item do RH.
            </p>
          )}
          <p className="ds-small mt-3 text-[color:var(--fg-3)]">
            Os dados de pessoal ficam num banco separado, de propósito: uma falha no sistema
            principal não os alcança. O acesso é concedido lá, na tabela <code>rh_papeis</code>.
          </p>
        </Card>
      </ContentArea>
    );
  }

  const sb = rhClient();
  const anoInicio = `${new Date().getFullYear()}-01-01`;
  const [{ data: emps }, { data: aus }] = await Promise.all([
    sb.from("employees")
      .select("id, nome, email_corporativo, cargo, departamento, regime, admissao, desligamento")
      .order("desligamento", { ascending: true, nullsFirst: true }).order("nome"),
    sb.from("ausencias")
      .select("id, employee_id, tipo, inicio, fim, dias, status, employees(nome)")
      .gte("inicio", anoInicio).order("inicio", { ascending: false }),
  ]);

  const diasPorPessoa = new Map<string, number>();
  for (const a of aus ?? []) {
    if (a.status !== "aprovada") continue;
    diasPorPessoa.set(a.employee_id as string,
      (diasPorPessoa.get(a.employee_id as string) ?? 0) + Number(a.dias ?? 0));
  }

  const pessoas: PessoaLinha[] = (emps ?? []).map((e) => ({
    id: e.id, nome: e.nome, email: e.email_corporativo, cargo: e.cargo,
    departamento: e.departamento, regime: e.regime, admissao: e.admissao,
    desligamento: e.desligamento, ausenciasNoAno: diasPorPessoa.get(e.id as string) ?? 0,
  }));

  const ausencias: AusenciaLinha[] = (aus ?? []).map((a) => ({
    id: a.id, tipo: a.tipo, inicio: a.inicio, fim: a.fim, dias: Number(a.dias ?? 0), status: a.status,
    pessoa: (a.employees as unknown as { nome: string } | null)?.nome ?? "—",
  }));

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "RH" }]} className="mb-4" />
      <PageHeader
        eyebrow="RH"
        title="Pessoas"
        subtitle="O time da Salestrack — admissão, ausências e histórico. Estes dados vivem num banco separado, e toda leitura de salário ou saúde fica registrada."
      />
      <Pessoal pessoas={pessoas} ausencias={ausencias} papel={acesso.papel!} />
    </ContentArea>
  );
}
