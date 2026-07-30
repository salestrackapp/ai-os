import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { ContentArea, PageHeader, Card, CopilotCard, EmptyState, Badge, StatusDot, botaoClasses } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { HelpButton } from "@/components/guidance/HelpButton";
import { FirstSteps } from "@/components/guidance/FirstSteps";
import { computeGuide } from "@/lib/guidance/first-steps";
import { countNotificacoes } from "@/lib/relacionamento/notify";
import { DEAL_STAGES, STAGE_LABELS, brl, daysSince, STAGNATION_DAYS, type Deal } from "@/lib/types";

export const dynamic = "force-dynamic";
const CLOSED = ["cliente", "perdido"];
const SEV_TONE: Record<string, "danger" | "warn" | "neutral"> = { critico: "danger", aviso: "warn" };

export default async function Hoje() {
  const supabase = await createClient();
  const membership = await currentMembership();
  const guide = membership?.userId && membership?.orgId ? await computeGuide("admin", membership.orgId, membership.userId, "conhecer-hoje") : null;
  const relNotifs = await countNotificacoes();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * 86_400_000);

  const [{ data: deals }, { data: tasks }, { data: alerts }, { data: sessions }, { data: revisao }, { data: roiPend }, { data: orgs }] = await Promise.all([
    supabase.from("deals").select("id, title, stage, score, value_estimated, last_activity_at").is("deleted_at", null),
    supabase.from("tasks").select("id, title, due_date, deal_id").eq("done", false).not("due_date", "is", null).order("due_date"),
    supabase.from("alerts").select("id, kind, severity, message, created_at").neq("status", "resolvido").order("created_at", { ascending: false }),
    supabase.from("sessions").select("id, title, org_id, scheduled_at, status").gte("scheduled_at", now.toISOString()).lte("scheduled_at", in7.toISOString()).order("scheduled_at"),
    supabase.from("studio_deliverables").select("id, title, kind, org_id").eq("status", "em_revisao"),
    supabase.from("roi_reports").select("id, org_id, periodo").eq("publicado", false),
    supabase.from("organizations").select("id, name"),
  ]);

  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  const dealList = (deals as Deal[]) ?? [];
  const active = dealList.filter((d) => !CLOSED.includes(d.stage));
  const overdue = (tasks ?? []).filter((t) => t.due_date && t.due_date <= todayStr);
  const revisaoList = revisao ?? [];
  const roiList = roiPend ?? [];
  const stagnant = active.find((d) => { const dd = daysSince(d.last_activity_at); return dd !== null && dd >= STAGNATION_DAYS && ["diagnostico", "proposta", "fechamento"].includes(d.stage); });
  const hotSignal = active.find((d) => d.score >= 20 && ["sinal", "qualificado"].includes(d.stage));

  // 3 ações do dia — tom copiloto (achado + ação)
  type Acao = { finding: string; label: string; href: string; metric?: { value: string; label: string } };
  const acoes: Acao[] = [];
  if (overdue.length) acoes.push({ finding: `Você tem ${overdue.length} ${overdue.length === 1 ? "tarefa vencida" : "tarefas vencidas"} pedindo follow-up.`, label: "Ver tarefas", href: "/admin/tarefas", metric: { value: String(overdue.length), label: "vencidas" } });
  if (revisaoList.length) acoes.push({ finding: `${revisaoList.length} ${revisaoList.length === 1 ? "entregável aguarda" : "entregáveis aguardam"} sua aprovação antes de ir ao cliente.`, label: "Revisar no Estúdio", href: "/admin/entregaveis", metric: { value: String(revisaoList.length), label: "em revisão" } });
  if (stagnant) { const dd = daysSince(stagnant.last_activity_at); acoes.push({ finding: `"${stagnant.title}" está parado há ${dd} dias na fase ${STAGE_LABELS[stagnant.stage]}.`, label: "Retomar deal", href: `/admin/crm/${stagnant.id}` }); }
  if (acoes.length < 3 && hotSignal) acoes.push({ finding: `"${hotSignal.title}" tem score ${hotSignal.score} e ainda não foi abordado.`, label: "Abordar agora", href: `/admin/crm/${hotSignal.id}` });
  if (acoes.length < 3 && roiList.length) acoes.push({ finding: `${roiList.length} ${roiList.length === 1 ? "relatório de ROI" : "relatórios de ROI"} em rascunho, prontos para revisar e publicar.`, label: "Publicar ROI", href: "/admin/roi", metric: { value: String(roiList.length), label: "a publicar" } });
  const top3 = acoes.slice(0, 3);

  // Pipeline em movimento
  const funnel = DEAL_STAGES.map((s) => ({ stage: STAGE_LABELS[s], qtd: active.filter((d) => d.stage === s).length, valor: active.filter((d) => d.stage === s).reduce((a, d) => a + (d.value_estimated ?? 0), 0) }));
  const pipelineTotal = active.reduce((a, d) => a + (d.value_estimated ?? 0), 0);
  const maxQtd = Math.max(1, ...funnel.map((f) => f.qtd));
  const aprovacoes = [
    ...revisaoList.map((d) => ({ id: `d${d.id}`, label: d.title, meta: orgName[d.org_id] ?? "—", tag: "entregável", href: "/admin/entregaveis" })),
    ...roiList.map((r) => ({ id: `r${r.id}`, label: `ROI · ${orgName[r.org_id] ?? "—"}`, meta: r.periodo ? new Date(r.periodo + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "", tag: "roi", href: "/admin/roi" })),
  ];

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Hoje" }]} className="mb-4" />
      <PageHeader eyebrow="Hoje" title={`Bom dia — ${top3.length ? `${top3.length} ${top3.length === 1 ? "ação" : "ações"} para agora` : "tudo sob controle"}`}
        subtitle="O cockpit do sistema: o que precisa de você, os alertas, o funil em movimento e a semana pela frente."
        comoUsar={<HelpButton routeKey="/admin/hoje" />}
        actions={<Link href="/admin/jornadas" className={botaoClasses()}><Icon name="rocket" size={15} /> Painel de jornadas</Link>} />

      {guide && <FirstSteps surface="admin" guide={guide} />}

      {relNotifs > 0 && (
        <Link href="/admin/relacionamento" className="mb-6 flex items-center justify-between gap-3 rounded-ds-card border border-hairline bg-[var(--tile)] px-4 py-3 transition-colors hover:border-[color:var(--brand-light)]">
          <span className="flex items-center gap-2.5 font-montserrat text-[13.5px] text-[color:var(--brand-deep)]"><Icon name="chat" size={16} /> Você tem <b>{relNotifs}</b> {relNotifs === 1 ? "novidade" : "novidades"} no Relacionamento (conversas/atribuições).</span>
          <span className="font-montserrat text-[13px] font-semibold text-[color:var(--brand)]">Abrir →</span>
        </Link>
      )}

      {/* 3 ações do dia */}
      <section className="mb-8" data-tour="admin-hoje">
        <p className="ds-eyebrow mb-3">Ações do dia</p>
        {top3.length === 0 ? (
          <EmptyState icon={<Icon name="tasks" size={22} />} title="Nada urgente por agora"
            description="Sem tarefas vencidas, aprovações ou deals parados. Bom momento para prospectar." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {top3.map((a, i) => (
              <Link key={i} href={a.href} className="block">
                <CopilotCard agent="Copiloto de operações" status="ativo" finding={a.finding} actionLabel={a.label} metric={a.metric} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pipeline em movimento */}
        <section className="lg:col-span-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <p className="ds-eyebrow">Pipeline em movimento</p>
              <span className="font-montserrat text-sm font-semibold text-[color:var(--fg-1)] tabular-nums">{brl(pipelineTotal)}</span>
            </div>
            {active.length === 0 ? <p className="ds-small">Sem deals ativos no funil.</p> : (
              <div className="space-y-2.5">
                {funnel.map((f) => (
                  <Link key={f.stage} href="/admin/crm" className="flex items-center gap-3 group">
                    <span className="w-24 shrink-0 font-montserrat text-[14px] text-[color:var(--fg-2)]">{f.stage}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--gray-100)]">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(f.qtd / maxQtd) * 100}%`, background: "var(--grad-brand)" }} />
                    </span>
                    <span className="w-8 shrink-0 text-right font-jbmono text-[13px] text-[color:var(--fg-1)] tabular-nums">{f.qtd}</span>
                    <span className="hidden w-24 shrink-0 text-right font-jbmono text-[13px] text-[color:var(--fg-3)] sm:block tabular-nums">{brl(f.valor)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* Alertas */}
        <section>
          <Card>
            <p className="ds-eyebrow mb-3">Alertas</p>
            {(alerts ?? []).length === 0 ? (
              <div className="flex items-center gap-2"><StatusDot status="ativo" /><p className="ds-small !mt-0">Tudo tranquilo — nenhum alerta aberto.</p></div>
            ) : (
              <ul className="space-y-3">
                {(alerts ?? []).slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: a.severity === "critico" ? "var(--danger)" : a.severity === "aviso" ? "var(--warn)" : "var(--gray-400)" }} />
                    <div className="min-w-0">
                      <p className="font-montserrat text-[14px] leading-snug text-[color:var(--fg-1)]">{a.message}</p>
                      <Badge tone={SEV_TONE[a.severity] ?? "neutral"} className="mt-1">{a.severity}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Sessões da semana */}
        <section>
          <Card>
            <div className="mb-3 flex items-center justify-between"><p className="ds-eyebrow">Sessões da semana</p><Icon name="calendar" size={16} className="text-[color:var(--fg-3)]" /></div>
            {(sessions ?? []).length === 0 ? (
              <p className="ds-small">Nenhuma sessão ao vivo nos próximos 7 dias.</p>
            ) : (
              <ul className="space-y-3">
                {(sessions ?? []).map((s) => (
                  <li key={s.id} className="border-b border-hairline pb-2.5 last:border-0 last:pb-0">
                    <p className="font-montserrat text-[14px] font-medium text-[color:var(--fg-1)]">{s.title || "Sessão ao vivo"}</p>
                    <p className="ds-small !mt-0.5">{orgName[s.org_id] ?? "—"} · {new Date(s.scheduled_at).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Aprovações pendentes */}
        <section className="lg:col-span-2">
          <Card>
            <p className="ds-eyebrow mb-3">Aprovações pendentes</p>
            {aprovacoes.length === 0 ? (
              <EmptyState icon={<Icon name="fileText" size={20} />} title="Nenhuma aprovação na fila"
                description="Entregáveis e relatórios aparecem aqui quando estiverem prontos para sua revisão." />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {aprovacoes.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className="flex items-center gap-3 py-2.5 group">
                      <Badge tone="brand">{a.tag}</Badge>
                      <span className="min-w-0 flex-1"><span className="block truncate font-montserrat text-[14px] text-[color:var(--fg-1)] group-hover:text-[color:var(--brand)]">{a.label}</span><span className="ds-small !mt-0">{a.meta}</span></span>
                      <span className="text-[color:var(--fg-4)]">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      <p className="ds-small mt-8">
        Procurando o dashboard clássico com gráficos? <Link href="/admin/dashboard" className="text-[color:var(--brand)] hover:underline">Abrir dashboard</Link>.
      </p>
    </ContentArea>
  );
}
