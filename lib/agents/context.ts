import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { SESSION_TYPE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/types";

/** Palavras relevantes (>3 letras) da pergunta, para casar Receitas. */
function keywords(q: string): string[] {
  return [...new Set((q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3))].slice(0, 8);
}

/**
 * Monta um contexto ENXUTO para o agente, APENAS de fontes internas do AI OS e
 * ESTRITAMENTE da org informada. Nunca busca nada fora do AI OS nem de outra org.
 */
export async function buildClientContext(orgId: string, question: string): Promise<string> {
  const sb = createServiceClient();
  const nowIso = new Date().toISOString();
  const [{ data: org }, { data: proj }, { data: dels }, { data: assets }, { data: nextS }, { data: lastS }, { data: credits }, { data: recipes }, { data: mems }] = await Promise.all([
    sb.from("organizations").select("name").eq("id", orgId).single(),
    sb.from("projects").select("name, phase, status, progress_pct, timeline").eq("org_id", orgId).order("created_at").limit(1).maybeSingle(),
    sb.from("deliverables").select("title, status, frente, due_date").eq("org_id", orgId).order("due_date", { nullsFirst: false }).limit(20),
    sb.from("library_assets").select("title, type").or(`org_id.eq.${orgId},org_id.is.null`).order("created_at", { ascending: false }).limit(20),
    sb.from("sessions").select("title, type, scheduled_at").eq("org_id", orgId).eq("status", "agendada").gte("scheduled_at", nowIso).order("scheduled_at").limit(1).maybeSingle(),
    sb.from("sessions").select("title, summary_md, scheduled_at").eq("org_id", orgId).eq("status", "realizada").order("scheduled_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("session_credits").select("type, total, consumed").eq("org_id", orgId),
    sb.from("playbook_recipes").select("titulo, frente, oque, perfil, tempo_min").eq("published", true).limit(60),
    sb.from("memories").select("content, created_at").eq("org_id", orgId).eq("scope", "client").order("created_at", { ascending: false }).limit(6),
  ]);

  const parts: string[] = [];
  parts.push(`Cliente: ${org?.name ?? "—"}`);
  if (proj) parts.push(`Programa: "${proj.name}" · fase atual: ${proj.phase ?? "—"} · status: ${PROJECT_STATUS_LABELS[proj.status] ?? proj.status} · progresso: ${proj.progress_pct ?? 0}%`);
  const timeline = Array.isArray(proj?.timeline) ? (proj!.timeline as { n: number; titulo: string }[]) : [];
  if (timeline.length) parts.push(`Linha do tempo: ${timeline.map((f) => `${f.n}. ${f.titulo}`).join(" → ")}`);

  if (dels?.length) parts.push(`Entregáveis:\n${dels.map((d) => `- ${d.title} [${d.status}]${d.frente ? ` · ${d.frente}` : ""}${d.due_date ? ` · prazo ${d.due_date}` : ""}`).join("\n")}`);

  if (nextS) parts.push(`Próxima sessão: ${nextS.title} (${SESSION_TYPE_LABELS[nextS.type] ?? nextS.type}) em ${nextS.scheduled_at ? new Date(nextS.scheduled_at).toLocaleString("pt-BR") : "—"}`);
  else parts.push("Próxima sessão: nenhuma agendada.");
  if (lastS?.summary_md) parts.push(`Última sessão realizada (${lastS.title}) — resumo: ${lastS.summary_md.slice(0, 500)}`);
  if (credits?.length) parts.push(`Créditos de sessão: ${credits.map((c) => `${SESSION_TYPE_LABELS[c.type] ?? c.type} ${Math.max(0, c.total - (c.consumed ?? 0))}/${c.total}`).join(" · ")}`);

  if (assets?.length) parts.push(`Materiais na Biblioteca: ${assets.map((a) => a.title).join("; ")}`);

  // Receitas relevantes à pergunta (por palavra-chave); senão, algumas de entrada
  const kw = keywords(question);
  const rel = (recipes ?? []).filter((r) => kw.length && kw.some((k) => `${r.titulo} ${r.frente ?? ""} ${r.oque ?? ""}`.toLowerCase().includes(k)));
  const chosen = (rel.length ? rel : (recipes ?? []).slice(0, 6)).slice(0, 8);
  if (chosen.length) parts.push(`Receitas do Playbook${rel.length ? " relevantes" : ""}:\n${chosen.map((r) => `- ${r.titulo} (${r.frente ?? "geral"}${r.tempo_min ? `, ${r.tempo_min}min` : ""}): ${r.oque ?? ""}`).join("\n")}`);

  if (mems?.length) parts.push(`Memória do cliente (resumos de conversas anteriores):\n${mems.map((m) => `- ${m.content}`).join("\n")}`);

  return parts.join("\n\n");
}

/** Grava um resumo de conversa na memória da org (scope client, sem embedding). Auditado. */
export async function saveClientMemory(orgId: string, content: string, actorId?: string | null): Promise<void> {
  const text = (content || "").trim();
  if (!text) return;
  const sb = createServiceClient();
  await sb.from("memories").insert({ org_id: orgId, scope: "client", content: text.slice(0, 2000) });
  await auditService("memory.client_write", "memories", undefined, { chars: text.length }, orgId);
}
