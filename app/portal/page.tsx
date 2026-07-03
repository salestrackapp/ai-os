import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { notifyAdmin } from "@/lib/whatsapp";
import { emailAdmin } from "@/lib/email";
import {
  PROJECT_STATUS_LABELS, DELIVERABLE_STATUS_LABELS, brl,
  type Project, type Deliverable, type Session,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const SESSION_LABEL: Record<string, string> = {
  sessao_estrategica: "Sessão Estratégica", sprint_30d: "Sprint 30 dias", mentoria_trimestral: "Mentoria Trimestral",
  workshop: "Workshop", palestra: "Palestra", treinamento: "Treinamento", ai_academy: "AI Academy",
  ai_labs: "AI Labs", diagnostico_stack: "Diagnóstico de Stack",
};

export default async function PortalHome() {
  const m = await currentMembership();
  const orgId = m!.orgId!;
  const supabase = await createClient();
  const { data: proj } = await supabase.from("projects").select("*").eq("org_id", orgId).order("created_at").limit(1).single();
  const project = proj as Project | null;

  // Ativação por primeiro acesso + log (via service role — cliente não escreve projects)
  const svc = createServiceClient();
  await svc.from("portal_access_log").insert({ org_id: orgId, user_id: m!.userId });
  if (project && project.status === "onboarding") {
    await svc.from("projects").update({ status: "ativo", activated_at: new Date().toISOString(), activated_by: "primeiro_acesso" }).eq("id", project.id);
    await svc.from("audit_logs").insert({ org_id: orgId, actor_id: m!.userId, action: "program.activated", resource: "projects", resource_id: project.id, payload: { by: "primeiro_acesso" }, hash: "pending" });
    const { data: org } = await svc.from("organizations").select("name").eq("id", orgId).single();
    await notifyAdmin(`✓ ${org?.name ?? "cliente"} acessou o portal — programa ativo.`);
    await emailAdmin(`✓ Programa ativado — ${org?.name ?? ""}`, "Programa ativado", `<p><b>${org?.name ?? ""}</b> acessou o portal pela primeira vez. O programa passou para <b>ativo</b>.</p>`);
    project.status = "ativo";
  }

  const [{ data: deliverables }, { data: sessions }, { data: credits }] = await Promise.all([
    project ? supabase.from("deliverables").select("*").eq("org_id", orgId).order("due_date", { nullsFirst: false }) : Promise.resolve({ data: [] }),
    supabase.from("sessions").select("*").eq("org_id", orgId).gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1),
    supabase.from("session_credits").select("*").eq("org_id", orgId),
  ]);
  const nextSession = (sessions as Session[] | null)?.[0] ?? null;
  const timeline = (project?.timeline as { n: number; titulo: string; meses: number; descricao: string }[] | null) ?? [];

  if (!project) {
    return (
      <div>
        <h1 className="font-serif text-4xl font-semibold mb-2">Meu Programa</h1>
        <div className="card p-8 mt-4"><p className="text-sm text-muted">Seu programa está sendo preparado. Assim que iniciar, a linha do tempo e os entregáveis aparecerão aqui.</p></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card p-8">
        <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Meu Programa</p>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-serif text-4xl font-semibold">{project.name}</h1>
          <span className={project.status === "ativo" ? "badge-teal" : "badge-gold"}>{PROJECT_STATUS_LABELS[project.status] ?? project.status}</span>
        </div>
        <p className="text-sm text-muted mt-2">Fase atual: {project.phase}</p>
        <div className="mt-4 h-2 rounded-full bg-navy3 overflow-hidden max-w-md"><div className="h-full bg-gold" style={{ width: `${project.progress_pct ?? 0}%` }} /></div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="card p-6">
          <p className="label mb-4">Linha do tempo</p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {timeline.map((f, i) => (
              <div key={i} className="min-w-56 bg-navy3 border border-line rounded-lg p-5">
                <div className="w-7 h-7 rounded-full bg-[rgba(200,155,60,.14)] border border-goldline text-gold flex items-center justify-center font-mono text-sm mb-3">{f.n}</div>
                <p className="font-serif text-lg font-semibold">{f.titulo}</p>
                <p className="text-[11px] uppercase tracking-[.14em] text-muted2 mb-2">{f.meses} {f.meses === 1 ? "mês" : "meses"}</p>
                <p className="text-sm text-muted leading-relaxed">{f.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Entregáveis */}
        <div className="lg:col-span-2 card p-6">
          <p className="label mb-4">Entregáveis</p>
          <div className="space-y-2">
            {(deliverables as Deliverable[] | null)?.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 bg-navy3 border border-line rounded-lg px-4 py-3">
                <div><p className="text-sm text-cream">{d.title}</p>{d.frente && <p className="text-[11px] text-muted2">{d.frente}</p>}</div>
                <span className={d.status.startsWith("entregue") ? "badge-teal" : d.status === "bloqueado" ? "badge inline-flex text-[10px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10" : "badge-muted"}>{DELIVERABLE_STATUS_LABELS[d.status] ?? d.status}</span>
              </div>
            ))}
            {(!deliverables || deliverables.length === 0) && <p className="text-sm text-muted2">Nenhum entregável registrado ainda.</p>}
          </div>
        </div>

        {/* Sessões + créditos */}
        <div className="space-y-6">
          <div className="card p-6">
            <p className="label mb-3">Próxima sessão</p>
            {nextSession ? (
              <div>
                <p className="text-cream">{nextSession.title}</p>
                <p className="text-xs text-muted2">{nextSession.scheduled_at ? new Date(nextSession.scheduled_at).toLocaleString("pt-BR") : ""}</p>
                {nextSession.meet_link && <a href={nextSession.meet_link} target="_blank" className="text-gold text-sm hover:underline">Entrar ↗</a>}
              </div>
            ) : <p className="text-sm text-muted2">Nenhuma sessão agendada.</p>}
          </div>
          <div className="card p-6">
            <p className="label mb-3">Créditos de sessão</p>
            <div className="space-y-2">
              {(credits as { type: string; total: number; consumed: number }[] | null)?.map((c) => (
                <div key={c.type} className="flex justify-between text-sm"><span className="text-muted">{SESSION_LABEL[c.type] ?? c.type}</span><span className="font-mono text-cream">{c.total - (c.consumed ?? 0)}/{c.total}</span></div>
              ))}
              {(!credits || credits.length === 0) && <p className="text-sm text-muted2">Sem créditos.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5 border-goldline bg-[rgba(200,155,60,.04)]">
        <p className="text-sm text-muted">Seu programa opera com IA no seu próprio ambiente. O AI OS é a base de transformação e o canal de entrega — materiais, evolução e acompanhamento em um só lugar.</p>
      </div>
    </div>
  );
}
