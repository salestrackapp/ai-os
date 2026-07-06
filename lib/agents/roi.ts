import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { runAgent } from "@/lib/agents/runner";
import { auditService } from "@/lib/audit";
import { PROJECT_STATUS_LABELS } from "@/lib/types";

export type RoiMetrics = {
  periodo: string;
  playbook: { concluidas_mes: number; receitas_publicadas: number; usuarios_ativos: number; por_trilha: Record<string, number> };
  sessoes: { realizadas_mes: number; creditos_saldo: number; creditos_total: number };
  entregaveis: { concluidos: number; total: number };
  programa: { fase: string | null; progresso_pct: number; status: string | null };
};

/** 1º dia do mês (UTC) a partir de uma data. */
export function monthStart(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function monthEnd(d: Date): Date { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
export function periodoISO(d: Date): string { return monthStart(d).toISOString().slice(0, 10); }

/** Coleta métricas do mês — APENAS de fontes internas do AI OS, estritamente da org. */
export async function collectRoiMetrics(orgId: string, periodo: Date): Promise<RoiMetrics> {
  const sb = createServiceClient();
  const ini = monthStart(periodo).toISOString();
  const fim = monthEnd(periodo).toISOString();

  const [{ data: proj }, { data: prog }, { count: recipesPub }, { data: recipes }, { data: trilhas }, { count: sessoesMes }, { data: credits }, { data: dels }] = await Promise.all([
    sb.from("projects").select("phase, progress_pct, status").eq("org_id", orgId).order("created_at").limit(1).maybeSingle(),
    sb.from("recipe_progress").select("recipe_id, user_id").eq("org_id", orgId).eq("status", "concluida").gte("completed_at", ini).lt("completed_at", fim),
    sb.from("playbook_recipes").select("id", { count: "exact", head: true }).eq("published", true),
    sb.from("playbook_recipes").select("id, trilha_id"),
    sb.from("playbook_trilhas").select("id, titulo"),
    sb.from("sessions").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "realizada").gte("scheduled_at", ini).lt("scheduled_at", fim),
    sb.from("session_credits").select("total, consumed").eq("org_id", orgId),
    sb.from("deliverables").select("status").eq("org_id", orgId),
  ]);

  const trilhaOf: Record<string, string | null> = Object.fromEntries((recipes ?? []).map((r) => [r.id, r.trilha_id]));
  const trilhaName: Record<string, string> = Object.fromEntries((trilhas ?? []).map((t) => [t.id, t.titulo]));
  const porTrilha: Record<string, number> = {};
  const users = new Set<string>();
  for (const p of prog ?? []) {
    users.add(p.user_id as string);
    const tId = trilhaOf[p.recipe_id as string];
    const label = tId ? (trilhaName[tId] ?? "Sem trilha") : "Sem trilha";
    porTrilha[label] = (porTrilha[label] ?? 0) + 1;
  }
  const saldo = (credits ?? []).reduce((s, c) => s + Math.max(0, (c.total ?? 0) - (c.consumed ?? 0)), 0);
  const totalCred = (credits ?? []).reduce((s, c) => s + (c.total ?? 0), 0);
  const delsConcl = (dels ?? []).filter((d) => String(d.status).startsWith("entregue")).length;

  return {
    periodo: periodoISO(periodo),
    playbook: { concluidas_mes: (prog ?? []).length, receitas_publicadas: recipesPub ?? 0, usuarios_ativos: users.size, por_trilha: porTrilha },
    sessoes: { realizadas_mes: sessoesMes ?? 0, creditos_saldo: saldo, creditos_total: totalCred },
    entregaveis: { concluidos: delsConcl, total: (dels ?? []).length },
    programa: { fase: proj?.phase ?? null, progresso_pct: proj?.progress_pct ?? 0, status: proj?.status ?? null },
  };
}

function metricsToText(orgName: string, m: RoiMetrics): string {
  const trilhas = Object.entries(m.playbook.por_trilha).map(([t, n]) => `${t}: ${n}`).join(", ") || "nenhuma";
  return [
    `Cliente: ${orgName}`,
    `Mês de referência: ${m.periodo}`,
    `Programa: fase ${m.programa.fase ?? "—"}, status ${PROJECT_STATUS_LABELS[m.programa.status ?? ""] ?? m.programa.status ?? "—"}, progresso ${m.programa.progresso_pct}%`,
    `Playbook: ${m.playbook.concluidas_mes} receitas concluídas no mês por ${m.playbook.usuarios_ativos} pessoa(s) (de ${m.playbook.receitas_publicadas} publicadas). Por trilha: ${trilhas}.`,
    `Sessões ao vivo: ${m.sessoes.realizadas_mes} realizada(s) no mês. Créditos: ${m.sessoes.creditos_saldo} disponíveis de ${m.sessoes.creditos_total}.`,
    `Entregáveis: ${m.entregaveis.concluidos} concluídos de ${m.entregaveis.total}.`,
  ].join("\n");
}

/**
 * Gera (ou regenera) o relatório de ROI do mês: coleta métricas internas + narrativa do Agente de Sucesso.
 * Grava em roi_reports (publicado=false). Idempotente por (org, período). Auditado.
 */
export async function generateRoiReport(orgId: string, periodo: Date): Promise<{ id: string; degraded: boolean }> {
  const sb = createServiceClient();
  const metrics = await collectRoiMetrics(orgId, periodo);
  const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).single();
  const context = metricsToText(org?.name ?? "cliente", metrics);
  const result = await runAgent({
    agentKey: "agente_sucesso", orgId, extraContext: context, maxTokens: 900,
    userMessages: [{ role: "user", content: `Escreva a narrativa executiva de ROI do mês ${metrics.periodo} para este cliente, usando SOMENTE os números acima. 2 a 4 parágrafos curtos, tom motivador e honesto, terminando com o próximo passo recomendado.` }],
  });

  const { data: up } = await sb.from("roi_reports").upsert(
    { org_id: orgId, periodo: metrics.periodo, metricas: metrics, narrativa: result.degraded ? null : result.text, publicado: false },
    { onConflict: "org_id,periodo" },
  ).select("id").single();
  await auditService("roi.generate", "roi_reports", up?.id, { periodo: metrics.periodo, degraded: result.degraded }, orgId);
  return { id: up!.id, degraded: result.degraded };
}
