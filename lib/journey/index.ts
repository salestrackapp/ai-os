import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { auditService } from "@/lib/audit";
import { getNumber } from "@/lib/settings/resolve";
import { JOURNEY_STAGES, currentStage, journeyProgress, nextAction, isStageOverdue, seedStates, type StageState, type StageStatus } from "./stages";

export * from "./stages";

/** Gate de equipe. */
async function requireTeam(): Promise<{ userId: string; orgId: string }> {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin || !m.userId || !m.orgId) throw new Error("Apenas a equipe Salestrack.");
  return { userId: m.userId, orgId: m.orgId };
}

export async function getJourneySlaHoras(): Promise<number> {
  return (await getNumber("journey_sla_horas")) ?? 48;
}

/** Garante os 6 estados de uma jornada (idempotente). etapaAtual define qual fica "fazendo". */
export async function ensureJourneyStates(projectId: string, etapaAtual = 1): Promise<void> {
  const sb = createServiceClient();
  const { count } = await sb.from("journey_step_state").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  if ((count ?? 0) > 0) return;
  const nowISO = new Date().toISOString();
  const rows = seedStates(etapaAtual, nowISO).map((s) => ({ project_id: projectId, etapa: s.etapa, status: s.status, done_at: s.done_at ?? null, updated_at: nowISO }));
  await sb.from("journey_step_state").insert(rows);
}

export type JourneyRow = {
  projectId: string; orgId: string; orgName: string;
  contatoNome: string | null; contatoTelefone: string | null;
  etapaAtual: number; etapaTitulo: string; progresso: number;
  proximaAcao: string; owner: string | null; atrasada: boolean; status: string;
};

/** Monta uma linha de jornada (para board/ficha) a partir dos estados + org + contato. */
function montaRow(p: { id: string; org_id: string; status: string }, orgName: string, contato: { name: string | null; phone: string | null } | null, states: StageState[], slaHoras: number, nowISO: string): JourneyRow {
  const cur = currentStage(states);
  const na = nextAction(states);
  const curState = states.find((s) => s.etapa === cur);
  return {
    projectId: p.id, orgId: p.org_id, orgName,
    contatoNome: contato?.name ?? null, contatoTelefone: contato?.phone ?? null,
    etapaAtual: cur, etapaTitulo: na.titulo, progresso: journeyProgress(states),
    proximaAcao: na.acao, owner: curState?.owner ?? null,
    atrasada: curState ? isStageOverdue(curState, slaHoras, nowISO) : false, status: p.status,
  };
}

/** Jornada de um cliente (org). Cria os estados se faltarem. */
export async function getJourney(orgId: string): Promise<{ row: JourneyRow; states: StageState[] } | null> {
  await requireTeam();
  const sb = createServiceClient();
  const { data: proj } = await sb.from("projects").select("id, org_id, status").eq("org_id", orgId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!proj) return null;
  await ensureJourneyStates(proj.id);
  const [{ data: org }, { data: contato }, { data: states }] = await Promise.all([
    sb.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    sb.from("contacts").select("name, phone").eq("org_id", orgId).order("created_at").limit(1).maybeSingle(),
    sb.from("journey_step_state").select("etapa, status, next_action, owner, done_at, updated_at").eq("project_id", proj.id).order("etapa"),
  ]);
  const slaHoras = await getJourneySlaHoras();
  const st = (states ?? []) as StageState[];
  return { row: montaRow(proj, org?.name ?? "—", contato ?? null, st, slaHoras, new Date().toISOString()), states: st };
}

/** Todas as jornadas para o board. filtro: minhas (owner = eu) / todas. */
export async function listJourneys(filtro: "todas" | "minhas" = "todas"): Promise<JourneyRow[]> {
  const { userId } = await requireTeam();
  const sb = createServiceClient();
  const { data: projs } = await sb.from("projects").select("id, org_id, status").is("deleted_at", null).limit(500);
  if (!projs?.length) return [];
  const orgIds = [...new Set(projs.map((p) => p.org_id))];
  const projIds = projs.map((p) => p.id);
  const [{ data: orgs }, { data: contatos }, { data: states }] = await Promise.all([
    sb.from("organizations").select("id, name").in("id", orgIds),
    sb.from("contacts").select("org_id, name, phone, created_at").in("org_id", orgIds).order("created_at"),
    sb.from("journey_step_state").select("project_id, etapa, status, next_action, owner, done_at, updated_at").in("project_id", projIds).order("etapa"),
  ]);
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const primeiroContato = new Map<string, { name: string | null; phone: string | null }>();
  for (const c of contatos ?? []) if (!primeiroContato.has(c.org_id)) primeiroContato.set(c.org_id, { name: c.name, phone: c.phone });
  const statesByProj = new Map<string, StageState[]>();
  for (const s of (states ?? []) as (StageState & { project_id: string })[]) {
    const arr = statesByProj.get(s.project_id) ?? []; arr.push(s); statesByProj.set(s.project_id, arr);
  }
  const slaHoras = await getJourneySlaHoras();
  const nowISO = new Date().toISOString();
  const rows = projs.map((p) => {
    let st = statesByProj.get(p.id) ?? [];
    if (!st.length) st = seedStates(1, nowISO); // jornada sem estados ainda → assume etapa 1 (o ensure roda na abertura)
    return montaRow(p, orgName.get(p.org_id) ?? "—", primeiroContato.get(p.org_id) ?? null, st, slaHoras, nowISO);
  });
  return filtro === "minhas" ? rows.filter((r) => r.owner === userId) : rows;
}

/** Muda o status de uma etapa (upsert) e marca updated_at/done_at. Auditado. */
export async function advanceStage(projectId: string, etapa: number, status: StageStatus): Promise<void> {
  const { orgId } = await requireTeam();
  if (etapa < 1 || etapa > JOURNEY_STAGES.length) throw new Error("Etapa inválida.");
  const sb = createServiceClient();
  const nowISO = new Date().toISOString();
  await sb.from("journey_step_state").upsert(
    { project_id: projectId, etapa, status, done_at: status === "concluido" ? nowISO : null, updated_at: nowISO },
    { onConflict: "project_id,etapa" },
  );
  await auditService("journey.advance", "projects", projectId, { etapa, status }, orgId);
}

export async function setNextAction(projectId: string, etapa: number, texto: string | null): Promise<void> {
  const { orgId } = await requireTeam();
  await createServiceClient().from("journey_step_state").update({ next_action: texto, updated_at: new Date().toISOString() }).eq("project_id", projectId).eq("etapa", etapa);
  await auditService("journey.next_action", "projects", projectId, { etapa }, orgId);
}

export async function setStageOwner(projectId: string, etapa: number, owner: string | null): Promise<void> {
  const { orgId } = await requireTeam();
  await createServiceClient().from("journey_step_state").update({ owner, updated_at: new Date().toISOString() }).eq("project_id", projectId).eq("etapa", etapa);
  await auditService("journey.owner", "projects", projectId, { etapa, owner }, orgId);
}
