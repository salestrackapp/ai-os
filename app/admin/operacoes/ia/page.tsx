import { ContentArea, PageHeader, Card, Badge, EmptyState, Kpi } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { currentMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { execucoesRecentes, custoPorOrg, registroConfigurado } from "@/lib/agents/registro";
import { dataHoraBR } from "@/lib/formato/data";

export const dynamic = "force-dynamic";

const usd = (v: number) => `US$ ${v.toFixed(4)}`;

export default async function CustoIaPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Operações" title="Custo de IA"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  if (!registroConfigurado()) {
    return (
      <ContentArea>
        <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Configurar", href: "/admin/configuracoes" }, { label: "Custo de IA" }]} className="mb-4" />
        <PageHeader eyebrow="Operações" title="Custo de IA por cliente"
          subtitle="Quanto cada execução de agente custou, e para quem." />
        <Card>
          <p className="ds-body">
            O registro de execuções ainda não está ligado. Ele grava no <b>agent-control</b>, que é
            outro projeto Supabase — falta apontar o AI OS para ele.
          </p>
          <p className="ds-small mt-3">
            Passo a passo em <b>docs/CONFIG_PENDENTE.md</b>, item do agent-control. Enquanto isso,
            os agentes funcionam normalmente: o que falta é o histórico, não a execução.
          </p>
        </Card>
      </ContentArea>
    );
  }

  const [execucoes, porOrg] = await Promise.all([execucoesRecentes(), custoPorOrg()]);

  // Os nomes das organizações vivem no banco do AI OS; o custo, no do agent-control. A junção é
  // feita aqui porque não existe join entre bancos.
  const svc = createServiceClient();
  const { data: orgs } = await svc.from("organizations").select("id, name");
  const nome = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));

  const total = porOrg.reduce((s, o) => s + o.custoUsd, 0);
  const falhas = execucoes.filter((e) => e.status === "failed").length;

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Configurar", href: "/admin/configuracoes" }, { label: "Custo de IA" }]} className="mb-4" />
      <PageHeader
        eyebrow="Operações"
        title="Custo de IA por cliente"
        subtitle="A fatura da Anthropic vem num número só. Aqui ele é aberto por cliente e por execução — e as falhas aparecem em vez de sumirem no log."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi value={usd(total)} label="Custo registrado" />
        <Kpi value={String(execucoes.length)} label="Execuções recentes" />
        <Kpi value={String(falhas)} label="Falharam" />
      </div>

      {porOrg.length > 0 && (
        <Card className="mb-6 p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Por cliente</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead><tr>{["Cliente", "Execuções", "Tokens", "Custo", "Última"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {porOrg.sort((a, b) => b.custoUsd - a.custoUsd).map((o) => (
                  <tr key={o.orgId}>
                    <td className="td font-medium text-[color:var(--fg-1)]">
                      {nome.get(o.orgId) ?? "(interno)"}
                    </td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{o.execucoes}</td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">
                      {(o.tokensEntrada + o.tokensSaida).toLocaleString("pt-BR")}
                    </td>
                    <td className="td font-jbmono font-semibold text-[color:var(--fg-1)]">{usd(o.custoUsd)}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{dataHoraBR(o.ultima)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {execucoes.length === 0 ? (
        <EmptyState title="Nenhuma execução registrada ainda"
          description="Assim que um agente rodar, a execução aparece aqui com o custo, o tempo e o resultado." />
      ) : (
        <Card className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Execuções recentes</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr>{["Agente", "Cliente", "Situação", "Tokens", "Custo", "Tempo", "Quando"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {execucoes.map((e) => (
                  <tr key={e.id}>
                    <td className="td text-[color:var(--fg-1)]">{e.agentKey ?? "—"}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">
                      {e.orgId ? (nome.get(e.orgId) ?? "—") : "interno"}
                    </td>
                    <td className="td">
                      {e.status === "failed"
                        ? <><Badge tone="danger">falhou</Badge>
                            {e.erro && <span className="mt-1 block text-xs text-[color:var(--fg-3)]">{e.erro}</span>}</>
                        : <Badge tone="success">ok</Badge>}
                    </td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{e.tokens.toLocaleString("pt-BR")}</td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{e.custoUsd == null ? "—" : usd(e.custoUsd)}</td>
                    <td className="td font-jbmono text-xs text-[color:var(--fg-2)]">
                      {e.duracaoMs == null ? "—" : `${(e.duracaoMs / 1000).toFixed(1)}s`}
                    </td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{dataHoraBR(e.quando)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </ContentArea>
  );
}
