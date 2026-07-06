import { NextResponse } from "next/server";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import { runAgentCore } from "@/lib/agents/runner";
import { buildClientContext } from "@/lib/agents/context";

const GUARD = `Você é o Consultor do Programa da Salestrack. Recomende a PRÓXIMA Receita do Playbook para este cliente, com base no programa dele e nas receitas ainda não concluídas listadas. Escolha UMA. Não invente receitas fora da lista.`;

/** Recomenda proativamente a próxima Receita do Playbook para o cliente (portal). */
export async function POST() {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId) return NextResponse.json({ error: "sem_contexto" }, { status: 401 });
  const sb = createServiceClient();
  const [{ data: recipes }, { data: prog }] = await Promise.all([
    sb.from("playbook_recipes").select("slug, titulo, frente, perfil, oque").eq("published", true).order("ordem"),
    sb.from("recipe_progress").select("recipe_id").eq("org_id", m.orgId).eq("status", "concluida"),
  ]);
  // mapeia concluídas por slug (via recipe id → slug)
  const doneIds = new Set((prog ?? []).map((p) => p.recipe_id as string));
  const { data: recIds } = await sb.from("playbook_recipes").select("id, slug");
  const slugById: Record<string, string> = Object.fromEntries((recIds ?? []).map((r) => [r.id, r.slug]));
  const doneSlugs = new Set([...doneIds].map((id) => slugById[id]).filter(Boolean));
  const pool = (recipes ?? []).filter((r) => !doneSlugs.has(r.slug));
  if (pool.length === 0) return NextResponse.json({ done: true, text: "Você já concluiu todas as receitas publicadas. 🎉" });

  const numbered = pool.map((r, i) => `${i + 1}. ${r.titulo} (${r.frente ?? "geral"} · ${r.perfil}) — ${r.oque ?? ""}`).join("\n");
  const ctx = await buildClientContext(m.orgId, "qual a próxima receita ideal");
  const r = await runAgentCore({
    agentKey: "consultor_programa", guardrails: GUARD,
    extraContext: `${ctx}\n\n=== RECEITAS DISPONÍVEIS (não concluídas) ===\n${numbered}`,
    contextLabel: "CONTEXTO DO PROGRAMA", maxTokens: 300,
    userMessages: [{ role: "user", content: "Escolha a melhor próxima receita para começar HOJE. Responda a primeira linha SÓ com o número da receita escolhida; depois, 1-2 frases dizendo por que ela faz sentido agora." }],
  });
  if (r.degraded) return NextResponse.json({ degraded: true, text: "Recomendação indisponível no momento." });
  const num = parseInt((r.text.match(/\d+/) ?? ["1"])[0], 10);
  const chosen = pool[Math.min(Math.max(1, num), pool.length) - 1] ?? pool[0];
  const why = r.text.replace(/^\s*\d+\.?\s*/, "").split(/\r?\n/).slice(1).join(" ").trim() || r.text.replace(/^\s*\d+[.)]?\s*/, "").trim();
  return NextResponse.json({ slug: chosen.slug, titulo: chosen.titulo, why });
}
