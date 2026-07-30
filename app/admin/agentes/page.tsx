import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { execucoesRecentes, registroConfigurado } from "@/lib/agents/registro";
import { Agentes, type AgenteLinha, type VersaoLinha, type GatilhoOpcao } from "@/components/admin/Agentes";
import { GATILHOS, contagemPorGatilho } from "@/lib/agents/gatilhos";
import { taxaDeAcerto } from "@/lib/relacionamento/sugestao";

export const dynamic = "force-dynamic";

export default async function AgentesPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Agentes" title="Agentes de IA"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const [{ data: prompts }, execucoes] = await Promise.all([
    svc.from("agent_prompts")
      .select("agent_key, versao, ativo, system_prompt, titulo, descricao, modelo, max_tokens, temperatura, motivo_da_versao, created_at, tipo, gatilho, instrucao_contexto")
      .order("agent_key").order("versao", { ascending: false }),
    registroConfigurado() ? execucoesRecentes(500) : Promise.resolve([]),
  ]);

  const [inscritos, acerto] = await Promise.all([contagemPorGatilho(), taxaDeAcerto()]);
  const gatilhos: GatilhoOpcao[] = Object.entries(GATILHOS).map(([chave, g]) => ({
    chave, rotulo: g.rotulo, descricao: g.descricao, recebe: g.recebe,
    inscritos: inscritos[chave] ?? 0,
  }));

  // Última rodada de cada agente — só as versões ATIVAS interessam para a lista.
  const { data: rodadas } = await svc.from("agente_rodadas")
    .select("agent_key, created_at").order("created_at", { ascending: false }).limit(200);
  const ultima = new Map<string, string>();
  for (const r of rodadas ?? []) {
    if (!ultima.has(r.agent_key as string)) ultima.set(r.agent_key as string, r.created_at as string);
  }

  // Custo e falhas por agente vêm do agent-control; prompt e versões, do AI OS. A junção é feita
  // aqui porque os dois vivem em bancos diferentes.
  const stats = new Map<string, { execucoes: number; custo: number; falhas: number }>();
  for (const e of execucoes) {
    const k = e.agentKey ?? "";
    const s = stats.get(k) ?? { execucoes: 0, custo: 0, falhas: 0 };
    s.execucoes++;
    s.custo += e.custoUsd ?? 0;
    if (e.status === "failed") s.falhas++;
    stats.set(k, s);
  }

  const porAgente = new Map<string, typeof prompts>();
  for (const p of prompts ?? []) {
    porAgente.set(p.agent_key, [...(porAgente.get(p.agent_key) ?? []), p]);
  }

  const agentes: AgenteLinha[] = [...porAgente.entries()]
    .filter(([, versoes]) => versoes!.some((v) => v.ativo))   // arquivado sai da lista, histórico fica
    .map(([key, versoes]) => {
    const ativa = versoes!.find((v) => v.ativo)!;
    const s = stats.get(key) ?? { execucoes: 0, custo: 0, falhas: 0 };
    return {
      agentKey: key,
      titulo: ativa.titulo ?? key,
      descricao: ativa.descricao,
      systemPrompt: ativa.system_prompt,
      versao: ativa.versao,
      tipo: (ativa.tipo ?? "sistema") as AgenteLinha["tipo"],
      gatilho: ativa.gatilho,
      instrucaoContexto: ativa.instrucao_contexto,
      ultimaRodada: ultima.get(key) ?? null,
      modelo: ativa.modelo,
      maxTokens: ativa.max_tokens,
      temperatura: ativa.temperatura,
      execucoes: s.execucoes, custoUsd: s.custo, falhas: s.falhas,
      versoes: versoes!.map((v): VersaoLinha => ({
        versao: v.versao, ativo: v.ativo, systemPrompt: v.system_prompt,
        motivo: v.motivo_da_versao, quando: v.created_at,
      })),
    };
  }).sort((a, b) => a.titulo.localeCompare(b.titulo));

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Configurar", href: "/admin/configuracoes" }, { label: "Agentes de IA" }]} className="mb-4" />
      <PageHeader
        eyebrow="Agentes"
        title="Agentes de IA"
        subtitle="Como cada agente se comporta, o que já custou, e o histórico de cada ajuste. Teste antes de publicar — e volte atrás quando precisar."
      />

      <Card className="mb-6">
        <p className="ds-body">
          Estes são os agentes que operam a Salestrack: o copiloto do admin, o consultor do cliente,
          os de prospecção e o do Estúdio.
        </p>
        <p className="ds-small mt-2">
          As instruções ficam no banco do AI OS, junto de quem executa — de propósito. Se
          dependessem de outro projeto, uma indisponibilidade dele pararia todos os agentes. O
          <b> agent-control</b> guarda o histórico de execução e o custo, que é o que ele faz bem.
        </p>
      </Card>

      {acerto && (() => {
        const total = acerto.aprovadas + acerto.editadas + acerto.descartadas;
        const pct = (n: number) => Math.round((n / total) * 100);
        return (
          <Card className="mb-6">
            <p className="mb-1 font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">Resposta assistida · o que aconteceu com os rascunhos</p>
            <p className="ds-small !mt-0 mb-3">
              De {total} rascunho(s) que o agente escreveu na inbox, este foi o desfecho. Muita edição
              ou muito descarte é sinal de que o prompt precisa de ajuste — não de que a equipe é exigente.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { rot: "Enviados sem mudança", n: acerto.aprovadas },
                { rot: "Editados antes de enviar", n: acerto.editadas },
                { rot: "Descartados", n: acerto.descartadas },
              ].map((x) => (
                <div key={x.rot} className="rounded-ds-card border border-hairline bg-[var(--bg-2)] p-3">
                  <p className="font-jbmono text-[22px] text-[color:var(--fg-1)]">{pct(x.n)}%</p>
                  <p className="font-montserrat text-[13px] text-[color:var(--fg-3)]">{x.rot} · {x.n}</p>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      <Agentes agentes={agentes} temHistorico={registroConfigurado()} gatilhos={gatilhos} />
    </ContentArea>
  );
}
