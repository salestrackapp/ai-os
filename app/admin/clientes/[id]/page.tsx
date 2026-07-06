/** Ficha 360 do cliente — visão única (consome os domínios existentes; aditivo). id = org do cliente. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { emailMap } from "@/lib/supabase/admin";
import { ContentArea, PageHeader, Card, Kpi, CopilotCard, EmptyState, Badge, StatusDot } from "@/components/ds";
import { Breadcrumbs, Tabs } from "@/components/ds/nav";
import { CycleSteps } from "@/components/ds/CycleSteps";
import { ProgramTimeline } from "@/components/timeline/ProgramTimeline";
import { AI_METHOD } from "@/lib/ds/method";
import { HelpButton } from "@/components/guidance/HelpButton";
import { Icon } from "@/components/ui/icons";
import {
  brl, PROJECT_STATUS_LABELS, DELIVERABLE_STATUS_LABELS, PROPOSAL_STATUS_LABELS, proposalStatusBadge,
  type ProposalItem, type Deliverable, type Session,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type Phase = { n: number; titulo: string; meses: number; descricao: string };
const nowISO = () => new Date().toISOString();
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const cycleStep = (p: { cycle_step?: number | null; progress_pct?: number | null; status?: string } | null) => {
  if (!p) return 0;
  if (typeof p.cycle_step === "number") return Math.max(0, Math.min(4, p.cycle_step));
  const pct = p.progress_pct ?? 0;
  return pct < 20 ? 0 : pct < 40 ? 1 : pct < 60 ? 2 : pct < 80 ? 3 : 4;
};

export default async function ClienteFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) notFound();
  const sb = await createClient();

  const { data: org } = await sb.from("organizations").select("id, name, is_salestrack").eq("id", id).maybeSingle();
  if (!org || org.is_salestrack) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: branding }, { data: project }, { data: health }, { data: sessions },
    { data: dels }, { data: studioDels }, { data: roi }, { data: proposals }, { data: contracts }, { data: members }, { data: invites },
  ] = await Promise.all([
    sb.from("tenant_branding").select("internal_name, logo_url, color_accent, level").eq("org_id", id).maybeSingle(),
    sb.from("projects").select("*").eq("org_id", id).is("deleted_at", null).order("created_at").limit(1).maybeSingle(),
    sb.from("tenant_health").select("churn_risk, engagement_score, mrr, margin_usd").eq("org_id", id).eq("date", today).maybeSingle(),
    sb.from("sessions").select("*").eq("org_id", id).order("scheduled_at", { ascending: false }).limit(12),
    sb.from("deliverables").select("*").eq("org_id", id).is("deleted_at", null).order("due_date", { nullsFirst: false }),
    sb.from("studio_deliverables").select("id, title, kind, status").eq("org_id", id).order("created_at", { ascending: false }).limit(10),
    sb.from("roi_reports").select("periodo, metricas, publicado").eq("org_id", id).order("periodo", { ascending: false }).limit(1).maybeSingle(),
    sb.from("proposals").select("id, title, status, items, monthly_platform_fee, created_at").eq("org_id", id).order("created_at", { ascending: false }),
    sb.from("contracts").select("id, status, created_at").eq("org_id", id).order("created_at", { ascending: false }),
    sb.from("memberships").select("user_id, role").eq("org_id", id),
    sb.from("invites").select("email, role, accepted_at").eq("org_id", id).is("accepted_at", null),
  ]);

  const step = cycleStep(project);
  const phases: Phase[] = Array.isArray(project?.timeline) ? (project!.timeline as Phase[]) : [];
  const delsList = (dels as Deliverable[] | null) ?? [];
  const delsDone = delsList.filter((d) => d.status.startsWith("entregue")).length;
  const studioRevisao = (studioDels ?? []).filter((d) => d.status === "em_revisao");
  const sessList = (sessions as Session[] | null) ?? [];
  const upcoming = sessList.filter((s) => s.scheduled_at && s.scheduled_at >= nowISO()).sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
  const past = sessList.filter((s) => s.scheduled_at && s.scheduled_at < nowISO());
  const metricas = (roi?.metricas ?? {}) as { playbook?: { concluidas_mes?: number; usuarios_ativos?: number }; sessoes?: { realizadas_mes?: number }; programa?: { progresso_pct?: number } };
  const emails = await emailMap((members ?? []).map((x) => x.user_id));

  // Saúde da conta
  const churn = health?.churn_risk ?? (project?.status === "ativo" ? "baixo" : project ? "medio" : null);
  const healthColor = churn === "alto" ? "var(--danger)" : churn === "medio" ? "var(--warn)" : churn === "baixo" ? "var(--success)" : "var(--gray-400)";
  const healthLabel = churn === "alto" ? "Risco alto" : churn === "medio" ? "Atenção" : churn === "baixo" ? "Saudável" : "Sem dados";

  // Resumo proativo (achados + ação)
  const acoes: { finding: string; label: string; href: string }[] = [];
  if (!project) acoes.push({ finding: "Este cliente ainda não tem um programa. Crie um para começar a entrega.", label: "Criar programa", href: "/admin/programas/novo" });
  else if (project.status === "onboarding") acoes.push({ finding: "O programa está em onboarding — o cliente ainda não ativou o portal.", label: "Abrir programa", href: `/admin/programas/${project.id}/editar` });
  if (studioRevisao.length) acoes.push({ finding: `${studioRevisao.length} entregável(is) aguardam sua aprovação antes de ir ao cliente.`, label: "Revisar no Estúdio", href: "/admin/entregaveis" });
  if (roi && !roi.publicado) acoes.push({ finding: "Há um relatório de ROI em rascunho, pronto para revisar e publicar.", label: "Publicar ROI", href: "/admin/roi" });
  if (upcoming[0]) acoes.push({ finding: `Próxima sessão: ${upcoming[0].title || "sessão"} em ${fmtDateTime(upcoming[0].scheduled_at)}.`, label: "Ver sessões", href: project ? `/admin/programas/${project.id}` : "#" });

  const resumoText = project
    ? `${org.name} está no passo ${AI_METHOD[step].title.toLowerCase()} do método${project.status === "ativo" ? ", com o programa ativo" : ` (status: ${PROJECT_STATUS_LABELS[project.status] ?? project.status})`}. ${delsDone}/${delsList.length} entregáveis concluídos${upcoming[0] ? `; próxima sessão em ${fmtDateTime(upcoming[0].scheduled_at)}` : ""}.`
    : `${org.name} ainda não tem programa provisionado. Ao fechar uma proposta, o programa nasce e o cliente ganha acesso.`;

  // ── Seções (renderizadas server-side; Tabs client apenas alterna) ──
  const resumo = (
    <div className="space-y-6">
      <CopilotCard agent="Copiloto do cliente" status="ativo" finding={resumoText}
        actionLabel={acoes[0]?.label} metric={{ value: `${AI_METHOD[step].title}`, label: "passo atual do ciclo" }} />
      {acoes.length > 1 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {acoes.slice(1, 4).map((a, i) => (
            <Link key={i} href={a.href} className="group flex items-center gap-3 rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4 shadow-ds-xs hover:-translate-y-0.5 hover:border-[color:rgba(79,31,255,0.28)] hover:shadow-ds-md transition-all">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--tile)] text-[color:var(--brand)]"><Icon name="sparkles" size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block font-montserrat text-[13px] font-medium leading-snug text-[color:var(--fg-1)]">{a.finding}</span><span className="mt-1 inline-flex items-center gap-1 font-montserrat text-[12px] font-semibold text-[color:var(--brand)]">{a.label} →</span></span>
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi value={`${project?.progress_pct ?? 0}%`} label="Progresso do programa" />
        <Kpi value={`${delsDone}/${delsList.length}`} label="Entregáveis concluídos" />
        <Kpi value={String(upcoming.length)} label="Sessões agendadas" />
        <Kpi value={roi ? `${metricas.programa?.progresso_pct ?? 0}%` : "—"} label={roi ? `ROI · ${roi.periodo?.slice(0, 7) ?? ""}` : "ROI (sem relatório)"} />
      </div>
    </div>
  );

  const programa = project ? (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="ds-eyebrow">Ciclo do método</p>
        <Link href={`/admin/programas/${project.id}/editar`} className="font-montserrat text-[13px] font-semibold text-[color:var(--brand)] hover:underline">Editar programa →</Link>
      </div>
      <CycleSteps currentStep={step} />
      <Card>
        <p className="ds-eyebrow mb-3">Fases &amp; marcos</p>
        {phases.length === 0 ? <p className="ds-small">Sem fases definidas. Adicione no editor do programa.</p> : (
          <ol className="space-y-2">
            {phases.map((ph, i) => (
              <li key={i} className="flex items-baseline gap-3"><span className="font-jbmono text-[12px] text-[color:var(--fg-3)]">{i + 1}</span><span><span className="font-montserrat text-[13px] font-medium text-[color:var(--fg-1)]">{ph.titulo}</span> <span className="ds-small">· {ph.meses} {ph.meses === 1 ? "mês" : "meses"} — {ph.descricao}</span></span></li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  ) : <EmptyState icon={<Icon name="rocket" size={22} />} title="Sem programa ainda" description="Ao fechar uma proposta, o programa é provisionado e aparece aqui." action={<Link href="/admin/programas/novo" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"><Icon name="rocket" size={15} /> Criar programa</Link>} />;

  const comercial = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="ds-small !mt-0">Ofertas vendidas em propostas e entregues pelo AI OS — <b>não</b> é plano de plataforma.</p>
        <Link href="/admin/propostas" className="font-montserrat text-[13px] font-semibold text-[color:var(--brand)] hover:underline">Nova proposta →</Link>
      </div>
      {(proposals ?? []).length === 0 ? (
        <EmptyState icon={<Icon name="pen" size={22} />} title="Nenhuma proposta ainda" description="As ofertas propostas a este cliente (Diagnose, Sprint, engajamento, Mentoria) aparecem aqui." action={<Link href="/admin/propostas" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"><Icon name="pen" size={15} /> Nova proposta</Link>} />
      ) : (
        <div className="overflow-x-auto rounded-ds-card border border-hairline bg-[var(--bg-1)] shadow-ds-xs">
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-hairline">{["Oferta / proposta", "Status", "Itens", "Valor"].map((h) => <th key={h} className="px-4 py-3 text-left font-jbmono text-[11px] uppercase tracking-[0.08em] text-[color:var(--fg-3)]">{h}</th>)}</tr></thead>
            <tbody>
              {(proposals ?? []).map((p) => {
                const items = (p.items as ProposalItem[]) ?? [];
                const total = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
                return (
                  <tr key={p.id} className="border-b border-hairline last:border-0 hover:bg-[var(--bg-2)]">
                    <td className="px-4 py-3"><Link href={`/admin/propostas/${p.id}`} className="font-montserrat text-[13px] text-[color:var(--fg-1)] hover:text-[color:var(--brand)]">{p.title}</Link></td>
                    <td className="px-4 py-3"><span className={proposalStatusBadge(p.status)}>{PROPOSAL_STATUS_LABELS[p.status] ?? p.status}</span></td>
                    <td className="px-4 py-3 font-jbmono text-[12px] text-[color:var(--fg-2)]">{items.length}</td>
                    <td className="px-4 py-3 text-right font-jbmono text-[12px] text-[color:var(--fg-1)]">{brl(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(contracts ?? []).length > 0 && <p className="ds-small">{(contracts ?? []).length} contrato(s) · último status: {contracts![0].status}</p>}
    </div>
  );

  const sessoes = (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-3 flex items-center justify-between"><p className="ds-eyebrow">Próximas sessões</p>{project && <Link href={`/admin/programas/${project.id}`} className="font-montserrat text-[12px] font-semibold text-[color:var(--brand)] hover:underline">Agendar →</Link>}</div>
        {upcoming.length === 0 ? <p className="ds-small">Nenhuma sessão agendada.</p> : <ul className="space-y-2">{upcoming.map((s) => <li key={s.id} className="border-b border-hairline pb-2 last:border-0"><p className="font-montserrat text-[13px] font-medium text-[color:var(--fg-1)]">{s.title || "Sessão"}</p><p className="ds-small !mt-0">{fmtDateTime(s.scheduled_at)}</p></li>)}</ul>}
      </Card>
      <Card>
        <p className="ds-eyebrow mb-3">Histórico</p>
        {past.length === 0 ? <p className="ds-small">Sem sessões realizadas ainda.</p> : <ul className="space-y-2">{past.slice(0, 8).map((s) => <li key={s.id} className="flex items-center justify-between gap-2 border-b border-hairline pb-2 last:border-0"><span className="font-montserrat text-[13px] text-[color:var(--fg-1)]">{s.title || "Sessão"}</span><span className="ds-small !mt-0">{fmtDate(s.scheduled_at)}</span></li>)}</ul>}
      </Card>
    </div>
  );

  const entregaveis = (
    <div className="space-y-6">
      <Card>
        <div className="mb-3 flex items-center justify-between"><p className="ds-eyebrow">Entregáveis do programa</p>{project && <Link href={`/admin/programas/${project.id}/editar`} className="font-montserrat text-[12px] font-semibold text-[color:var(--brand)] hover:underline">Editar →</Link>}</div>
        {delsList.length === 0 ? <p className="ds-small">Nenhum entregável registrado.</p> : <ul className="space-y-2">{delsList.map((d) => <li key={d.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-hairline bg-[var(--bg-2)] px-4 py-2.5"><span className="font-montserrat text-[13px] text-[color:var(--fg-1)]">{d.title}</span><Badge tone={d.status.startsWith("entregue") ? "success" : d.status === "bloqueado" ? "danger" : "neutral"}>{DELIVERABLE_STATUS_LABELS[d.status] ?? d.status}</Badge></li>)}</ul>}
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between"><p className="ds-eyebrow">Documentos executivos (Estúdio)</p><Link href="/admin/entregaveis" className="font-montserrat text-[12px] font-semibold text-[color:var(--brand)] hover:underline">Novo →</Link></div>
        {(studioDels ?? []).length === 0 ? <p className="ds-small">Nenhum documento gerado. Gere ROI, proposta ou dossiê no Estúdio.</p> : <ul className="space-y-2">{(studioDels ?? []).map((d) => <li key={d.id} className="flex items-center justify-between gap-2"><span className="font-montserrat text-[13px] text-[color:var(--fg-1)]">{d.title}</span><Badge tone={["aprovado", "entregue"].includes(d.status) ? "success" : "neutral"}>{d.status}</Badge></li>)}</ul>}
      </Card>
    </div>
  );

  const resultados = roi ? (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi value={String(metricas.playbook?.concluidas_mes ?? 0)} label="Receitas concluídas" />
      <Kpi value={String(metricas.playbook?.usuarios_ativos ?? 0)} label="Usuários ativos" />
      <Kpi value={String(metricas.sessoes?.realizadas_mes ?? 0)} label="Sessões realizadas" />
      <Kpi value={`${metricas.programa?.progresso_pct ?? 0}%`} label="Progresso" />
    </div>
  ) : <EmptyState icon={<Icon name="chart" size={22} />} title="Sem resultados ainda" description="Gere um relatório de ROI para mostrar o valor entregue em números." action={<Link href="/admin/roi" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"><Icon name="chart" size={15} /> Abrir ROI</Link>} />;

  const equipe = (
    <Card>
      <p className="ds-eyebrow mb-3">Pessoas do cliente</p>
      {(members ?? []).length === 0 && (invites ?? []).length === 0 ? <p className="ds-small">Nenhum membro. O cliente convida o time pelo portal.</p> : (
        <ul className="space-y-2">
          {(members ?? []).map((mm) => <li key={mm.user_id} className="flex items-center justify-between gap-2 border-b border-hairline pb-2 last:border-0"><span className="font-montserrat text-[13px] text-[color:var(--fg-1)]">{emails[mm.user_id] ?? "—"}</span><Badge>{mm.role}</Badge></li>)}
          {(invites ?? []).map((iv, i) => <li key={`i${i}`} className="flex items-center justify-between gap-2"><span className="font-montserrat text-[13px] text-[color:var(--fg-2)]">{iv.email}</span><Badge tone="warn">convite pendente</Badge></li>)}
        </ul>
      )}
    </Card>
  );

  const timeline = project
    ? <ProgramTimeline projectId={project.id} mode="conducao" />
    : <EmptyState icon={<Icon name="rocket" size={22} />} title="Sem linha do tempo ainda" description="A jornada aparece quando o programa ganhar marcos." action={<Link href="/admin/programas/novo" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"><Icon name="rocket" size={15} /> Criar programa</Link>} />;

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Clientes", href: "/admin/clientes" }, { label: org.name }]} className="mb-4" />
      <PageHeader eyebrow="Clientes" title={branding?.internal_name || org.name}
        subtitle={project ? `${PROJECT_STATUS_LABELS[project.status] ?? project.status} · passo ${step + 1}/5 (${AI_METHOD[step].title})` : "Sem programa provisionado"}
        comoUsar={<HelpButton routeKey="/admin/clientes" />}
        actions={<div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-ds-input border border-hairline px-3 py-2"><span className="h-2 w-2 rounded-full" style={{ background: healthColor }} /><span className="font-montserrat text-[13px] font-medium text-[color:var(--fg-1)]">{healthLabel}</span></span>
          <Link href={`/admin/clientes/${id}/caixa`} className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]"><Icon name="chat" size={15} /> Caixa de e-mail</Link>
          <Link href="/admin/propostas" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"><Icon name="pen" size={15} /> Nova proposta</Link>
        </div>} />

      <Tabs defaultTab="resumo" tabs={[
        { id: "resumo", label: "Resumo", content: resumo },
        { id: "programa", label: "Programa", content: programa },
        { id: "comercial", label: "Comercial", content: comercial },
        { id: "sessoes", label: "Sessões", content: sessoes },
        { id: "entregaveis", label: "Entregáveis", content: entregaveis },
        { id: "resultados", label: "Resultados", content: resultados },
        { id: "equipe", label: "Equipe", content: equipe },
        { id: "timeline", label: "Timeline", content: timeline },
      ]} />
    </ContentArea>
  );
}
