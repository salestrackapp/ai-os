import Link from "next/link";
import { ContentArea, PageHeader, Card, Badge, EmptyState, Kpi } from "@/components/ds";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalOrg } from "@/lib/portal";

export const dynamic = "force-dynamic";

/**
 * Visão do gestor: como a equipe dele está na formação.
 *
 * Sem filtro manual por org: a view `academy_enrollment_stats` tem `security_invoker = on`,
 * então a RLS das tabelas de baixo já limita o que este gestor enxerga. Escrever
 * `.eq("org_id", orgId)` aqui daria a impressão de que a segurança está no código.
 *
 * O gestor vê NOTA, não respostas. `academy_attempt_respostas` não entra na view.
 */
export default async function TurmaPage() {
  const m = await resolvePortalOrg();
  const podeVer = m!.adminView || m!.role === "client_admin" || m!.role === "sponsor";

  if (!podeVer) {
    return (
      <ContentArea>
        <PageHeader eyebrow="Formação" title="Turma" />
        <EmptyState title="Visão restrita à liderança"
          description="Esta tela mostra o andamento de toda a equipe. Se você quer ver o seu próprio progresso, é na trilha."
          action={<Link href="/academy/trilha" className="ds-focus text-sm font-semibold text-[color:var(--brand)]">Ir para a trilha →</Link>} />
      </ContentArea>
    );
  }

  const sb = await createClient();
  const { data } = await sb.from("academy_enrollment_stats")
    .select("*").not("org_id", "is", null).order("nome");

  const linhas = data ?? [];
  const CORTE_PARADO = 14 * 86_400_000;
  const agora = Date.now();

  const pct = (l: typeof linhas[number]) =>
    l.tarefas_total ? Math.round((Number(l.tarefas_feitas) / Number(l.tarefas_total)) * 100) : 0;

  const concluidos = linhas.filter((l) => l.tem_certificado).length;
  const media = linhas.length ? Math.round(linhas.reduce((s, l) => s + pct(l), 0) / linhas.length) : 0;
  const parados = linhas.filter((l) => {
    if (l.tem_certificado || pct(l) === 100) return false;
    const ult = l.ultima_atividade ? new Date(l.ultima_atividade).getTime() : new Date(l.created_at).getTime();
    return agora - ult > CORTE_PARADO;
  });

  return (
    <ContentArea>
      <PageHeader
        eyebrow="Formação"
        title="Turma"
        subtitle="Como sua equipe está na formação em agentes de IA. Você vê a nota de cada pessoa, não as respostas da prova."
      />

      {linhas.length === 0 ? (
        <EmptyState title="Ninguém matriculado ainda"
          description="Assim que a Salestrack alocar as vagas da sua empresa, a equipe aparece aqui." />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Kpi value={`${media}%`} label="Progresso médio" />
            <Kpi value={`${concluidos}/${linhas.length}`} label="Concluíram com certificado" />
            <Kpi value={String(parados.length)} label="Sem avançar há 14 dias"
              tone={parados.length > 0 ? "down" : "neutral"} />
          </div>

          {parados.length > 0 && (
            <Card className="mb-6">
              <p className="text-sm font-bold text-[color:var(--fg-1)]">Quem travou</p>
              <p className="ds-small mt-1">
                {parados.length === 1 ? "Uma pessoa" : `${parados.length} pessoas`} sem marcar nenhuma tarefa nos últimos
                14 dias. Costuma ser falta de tempo, não de interesse — um empurrão resolve.
              </p>
              <p className="mt-3 text-sm text-[color:var(--fg-2)]">
                {parados.map((l) => l.nome ?? l.email ?? "—").join(" · ")}
              </p>
            </Card>
          )}

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr>
                  {["Pessoa", "Progresso", "Última atividade", "Prova", "Certificado"].map((h) => <th key={h} className="th">{h}</th>)}
                </tr></thead>
                <tbody>
                  {linhas.map((l) => {
                    const p = pct(l);
                    return (
                      <tr key={l.enrollment_id}>
                        <td className="td">
                          <span className="block font-medium text-[color:var(--fg-1)]">{l.nome ?? "—"}</span>
                          <span className="block text-xs text-[color:var(--fg-3)]">{l.email ?? "—"}</span>
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-2.5">
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--gray-200)]">
                              <span className="block h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${p}%` }} />
                            </span>
                            <span className="font-jbmono text-xs text-[color:var(--fg-2)]">
                              {l.tarefas_feitas}/{l.tarefas_total}
                            </span>
                          </div>
                        </td>
                        <td className="td text-[color:var(--fg-2)]">
                          {l.ultima_atividade ? new Date(l.ultima_atividade).toLocaleDateString("pt-BR") : "não começou"}
                        </td>
                        <td className="td">
                          {l.tentativas === 0
                            ? <span className="text-[color:var(--fg-3)]">não fez</span>
                            : <Badge tone={l.aprovado ? "success" : "warn"}>
                                {l.aprovado ? `aprovado · ${l.melhor_nota}%` : `${l.melhor_nota ?? 0}%`}
                              </Badge>}
                        </td>
                        <td className="td">
                          {l.tem_certificado ? <Badge tone="success">emitido</Badge> : <span className="text-[color:var(--fg-3)]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </ContentArea>
  );
}
