import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolvePortalOrg } from "@/lib/portal";
import { notifyAdmin } from "@/lib/whatsapp";
import { emailAdmin } from "@/lib/email";
import { markChecklistItem } from "./onboarding-actions";
import { ContentArea, PageHeader, Card, Kpi, CopilotCard, EmptyState, Badge, StatusDot } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { CycleSteps } from "@/components/ds/CycleSteps";
import { ProgramTimeline } from "@/components/timeline/ProgramTimeline";
import { AI_METHOD } from "@/lib/ds/method";
import { Icon } from "@/components/ui/icons";
import { HelpButton } from "@/components/guidance/HelpButton";
import { FirstSteps } from "@/components/guidance/FirstSteps";
import { computeGuide } from "@/lib/guidance/first-steps";
import { DELIVERABLE_STATUS_LABELS, type Project, type Deliverable, type Session } from "@/lib/types";

export const dynamic = "force-dynamic";

const SESSION_LABEL: Record<string, string> = {
  sessao_estrategica: "Sessão Estratégica", sprint_30d: "Sprint 30 dias", mentoria_trimestral: "Mentoria Trimestral",
  workshop: "Workshop", palestra: "Palestra", treinamento: "Treinamento", ai_academy: "AI Academy", ai_labs: "AI Labs", diagnostico_stack: "Diagnóstico de Stack",
};

/** Etapa atual do AI Operating Method: o passo MARCADO pelo admin (cycle_step) ou, se não houver, derivado do progresso. */
function stepFromProject(p: (Project & { cycle_step?: number | null }) | null): number {
  if (!p) return 0;
  if (typeof p.cycle_step === "number") return Math.max(0, Math.min(4, p.cycle_step));
  if (p.status === "onboarding") return 0;
  const pct = p.progress_pct ?? 0;
  return pct < 20 ? 0 : pct < 40 ? 1 : pct < 60 ? 2 : pct < 80 ? 3 : 4;
}

export default async function Jornada() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  const supabase = await createClient();
  const { data: proj } = await supabase.from("projects").select("*").eq("org_id", orgId).is("deleted_at", null).order("created_at").limit(1).maybeSingle();
  const project = proj as Project | null;

  // Ativação por primeiro acesso + log — só no acesso real do cliente (não na visão admin).
  const svc = createServiceClient();
  if (!m!.adminView) await svc.from("portal_access_log").insert({ org_id: orgId, user_id: m!.userId });
  if (project && project.status === "onboarding" && !m!.adminView) {
    await svc.from("projects").update({ status: "ativo", activated_at: new Date().toISOString(), activated_by: "primeiro_acesso" }).eq("id", project.id);
    await svc.from("audit_logs").insert({ org_id: orgId, actor_id: m!.userId, action: "program.activated", resource: "projects", resource_id: project.id, payload: { by: "primeiro_acesso" }, hash: "pending" });
    const { data: org } = await svc.from("organizations").select("name").eq("id", orgId).single();
    await notifyAdmin(`✓ ${org?.name ?? "cliente"} acessou o portal — programa ativo.`);
    await emailAdmin(`✓ Programa ativado — ${org?.name ?? ""}`, "Programa ativado", `<p><b>${org?.name ?? ""}</b> acessou o portal pela primeira vez. O programa passou para <b>ativo</b>.</p>`);
    project.status = "ativo";
  }

  const [{ data: deliverables }, { data: sessions }, { data: credits }, { data: chk }] = await Promise.all([
    project ? supabase.from("deliverables").select("*").eq("org_id", orgId).order("due_date", { nullsFirst: false }) : Promise.resolve({ data: [] }),
    supabase.from("sessions").select("*").eq("org_id", orgId).gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1),
    supabase.from("session_credits").select("*").eq("org_id", orgId),
    supabase.from("onboarding_checklists").select("items, completed_at").eq("org_id", orgId).maybeSingle(),
  ]);
  const chkItems = (chk && !chk.completed_at && Array.isArray(chk.items)) ? (chk.items as { key: string; label: string; done: boolean }[]) : [];
  const chkLink: Record<string, string> = { consultor: "/portal/consultor", stack: "/portal/stack", equipe: "/portal/equipe" };
  const nextSession = (sessions as Session[] | null)?.[0] ?? null;
  const dels = (deliverables as Deliverable[] | null) ?? [];
  const delsDone = dels.filter((d) => d.status.startsWith("entregue")).length;
  const saldo = ((credits as { total: number; consumed: number }[] | null) ?? []).reduce((s, c) => s + Math.max(0, (c.total ?? 0) - (c.consumed ?? 0)), 0);
  const step = stepFromProject(project);
  const guide = !m!.adminView && m!.userId ? await computeGuide("portal", orgId, m!.userId, "entender-jornada") : null;

  if (!project) {
    return (
      <ContentArea>
        <Breadcrumbs items={[{ label: "Portal", href: "/portal" }, { label: "Jornada" }]} className="mb-4" />
        <PageHeader eyebrow="Jornada principal" title="Meu programa" subtitle="Seu programa está sendo preparado." comoUsar={<HelpButton routeKey="/portal" />} />
        <EmptyState icon={<Icon name="rocket" size={22} />} title="Programa em preparação"
          description="Assim que iniciar, sua jornada, entregáveis e sessões aparecerão aqui." guiaHref="/portal/ajuda" />
      </ContentArea>
    );
  }

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Portal", href: "/portal" }, { label: "Jornada" }]} className="mb-4" />
      <PageHeader eyebrow="Jornada principal" title={project.name}
        subtitle={`Fase atual: ${project.phase ?? "—"}`}
        comoUsar={<HelpButton routeKey="/portal" />}
        actions={<Link href="/portal/consultor" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand transition-colors hover:bg-brand-hover"><Icon name="sparkles" size={15} /> Falar com o Consultor</Link>} />

      {guide && <FirstSteps surface="portal" guide={guide} />}

      {/* Ativação (onboarding) */}
      {chkItems.length > 0 && !m!.adminView && (
        <Card bloom className="mb-6">
          <div className="mb-3 flex items-center gap-2"><Icon name="rocket" size={18} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Ative seu programa</p></div>
          <p className="ds-small mb-4">Alguns passos rápidos para começar com o pé direito.</p>
          <div className="space-y-2">
            {chkItems.map((it) => (
              <div key={it.key} className="flex items-center justify-between gap-3 rounded-[10px] border border-hairline bg-[var(--bg-2)] px-4 py-2.5">
                <span className={`font-montserrat text-[13px] ${it.done ? "text-[color:var(--fg-4)] line-through" : "text-[color:var(--fg-1)]"}`}>{it.label}</span>
                {!it.done && (
                  <div className="flex items-center gap-2">
                    {chkLink[it.key] && <Link href={chkLink[it.key]} className="font-montserrat text-[12px] font-medium text-[color:var(--brand)] hover:underline">abrir</Link>}
                    <form action={markChecklistItem.bind(null, it.key)}><button className="ds-focus rounded-[8px] border border-hairline-strong px-2.5 py-1 font-montserrat text-[12px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Concluir</button></form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Progresso */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi value={`${project.progress_pct ?? 0}%`} label="Progresso do programa" />
        <Kpi value={`${delsDone}/${dels.length}`} label="Entregáveis concluídos" />
        <Kpi value={String(saldo)} label="Créditos de sessão" />
        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-5 shadow-ds-xs">
          <p className="ds-small !mt-0 uppercase tracking-[0.08em] text-[10px]">Situação</p>
          <div className="mt-2"><StatusDot status={project.status === "ativo" ? "ativo" : "em curso"} live={project.status === "ativo"} /></div>
          <p className="ds-small mt-2">{AI_METHOD[step].title} · etapa {step + 1}/5</p>
        </div>
      </div>

      {/* A Jornada — AI Operating Method */}
      <section className="mb-8" data-tour="portal-jornada">
        <CycleSteps currentStep={step} />
      </section>

      {/* Linha do tempo do programa — a espinha da jornada (leitura) */}
      <section className="mb-8">
        <ProgramTimeline projectId={project.id} mode="leitura" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Entregáveis */}
        <section className="lg:col-span-2">
          <Card>
            <p className="ds-eyebrow mb-4">Entregáveis</p>
            {dels.length === 0 ? (
              <div className="flex items-start gap-3 rounded-[10px] border border-dashed border-hairline-strong bg-[var(--bg-2)] px-4 py-4">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--tile)] text-[color:var(--brand)]"><Icon name="fileText" size={16} /></span>
                <p className="ds-small !mt-0">Aqui ficam os documentos e entregas do seu programa. Assim que a Salestrack publicar o primeiro, ele aparece nesta lista — e você pode falar com o <Link href="/portal/consultor" className="text-[color:var(--brand)] hover:underline">Consultor</Link> a qualquer momento.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {dels.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-hairline bg-[var(--bg-2)] px-4 py-3">
                    <div className="min-w-0"><p className="truncate font-montserrat text-[13px] text-[color:var(--fg-1)]">{d.title}</p>{d.frente && <p className="ds-small !mt-0">{d.frente}</p>}</div>
                    <Badge tone={d.status.startsWith("entregue") ? "success" : d.status === "bloqueado" ? "danger" : "neutral"}>{DELIVERABLE_STATUS_LABELS[d.status] ?? d.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Próxima sessão + Consultor */}
        <section className="space-y-6">
          <Card>
            <p className="ds-eyebrow mb-3">Próxima sessão</p>
            {nextSession ? (
              <div>
                <p className="font-montserrat text-[14px] font-medium text-[color:var(--fg-1)]">{nextSession.title}</p>
                <p className="ds-small !mt-1">{nextSession.scheduled_at ? new Date(nextSession.scheduled_at).toLocaleString("pt-BR") : ""}</p>
                {nextSession.meet_link && <a href={nextSession.meet_link} target="_blank" className="mt-2 inline-flex font-montserrat text-[13px] font-medium text-[color:var(--brand)] hover:underline">Entrar na sala →</a>}
              </div>
            ) : <p className="ds-small">Nenhuma sessão agendada.</p>}
            <p className="ds-small mt-3 border-t border-hairline pt-3">
              Créditos por tipo: {((credits as { type: string; total: number; consumed: number }[] | null) ?? []).map((c) => `${SESSION_LABEL[c.type] ?? c.type} ${c.total - (c.consumed ?? 0)}/${c.total}`).join(" · ") || "sem créditos"}
            </p>
          </Card>
          <Link href="/portal/consultor" className="block">
            <CopilotCard agent="Consultor do Programa" status="ativo"
              finding="Posso resumir seu andamento, lembrar suas sessões e guiar você pelas Receitas do Playbook."
              actionLabel="Abrir consultor" />
          </Link>
        </section>
      </div>
    </ContentArea>
  );
}
