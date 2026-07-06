import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

// Contrato de saída = EXATAMENTE o que o motor de provisionamento da Fase 8 já lê.
export type Structure = {
  frentes: string[];
  timeline: { n: number; titulo: string; meses: number; descricao: string }[];
  deliverables: { frente?: string; title: string }[];
  agentes: Record<string, string>;
  biblioteca: { title: string; type: string }[];
};

/** Compila blocos + tom da vertical na `structure` única. Agrega por categoria. */
export function compileStructure(blocks: { category: string; content: Record<string, unknown> }[], defaultAgents?: Record<string, string>): Structure {
  const s: Structure = { frentes: [], timeline: [], deliverables: [], agentes: { ...(defaultAgents ?? {}) }, biblioteca: [] };
  for (const b of blocks) {
    const c = b.content ?? {};
    switch (b.category) {
      case "frente": if (c.frente) s.frentes.push(String(c.frente)); break;
      case "entregavel": if (c.title) s.deliverables.push({ frente: c.frente as string, title: String(c.title) }); break;
      case "marco": s.timeline.push({ n: Number(c.n) || s.timeline.length + 1, titulo: String(c.titulo ?? "Fase"), meses: Number(c.meses) || 3, descricao: String(c.descricao ?? "") }); break;
      case "agente": if (c.frente) s.agentes[String(c.frente)] = String(c.descricao ?? c.prompt ?? ""); break;
      case "biblioteca": if (c.title) s.biblioteca.push({ title: String(c.title), type: String(c.type ?? "documento") }); break;
      // kpi: reservado (não entra na structure da Fase 8; guardado em composed_from)
    }
  }
  s.frentes = [...new Set(s.frentes)];
  s.timeline.sort((a, b) => a.n - b.n);
  return s;
}

/**
 * Publica uma nova versão de um template a partir de blocos:
 * compila → grava em template_versions (version++) is_published → atualiza program_templates
 * (current_version + espelha structure). Auditado.
 */
export async function publishTemplateVersion(templateKey: string, blockKeys: string[], changelog: string, createdBy?: string | null): Promise<{ version: number }> {
  const sb = createServiceClient();
  const [{ data: tpl }, { data: blocks }] = await Promise.all([
    sb.from("program_templates").select("vertical_key").eq("key", templateKey).single(),
    sb.from("template_blocks").select("key, category, content").in("key", blockKeys.length ? blockKeys : ["__none__"]),
  ]);
  let defaultAgents: Record<string, string> | undefined;
  if (tpl?.vertical_key) { const { data: v } = await sb.from("template_verticals").select("default_agents").eq("key", tpl.vertical_key).maybeSingle(); defaultAgents = (v?.default_agents as Record<string, string>) ?? undefined; }
  // preserva a ordem pedida
  const ordered = blockKeys.map((k) => (blocks ?? []).find((b) => b.key === k)).filter(Boolean) as { category: string; content: Record<string, unknown> }[];
  const structure = compileStructure(ordered, defaultAgents);

  const { data: last } = await sb.from("template_versions").select("version").eq("template_key", templateKey).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  await sb.from("template_versions").update({ is_published: false }).eq("template_key", templateKey); // só uma publicada
  await sb.from("template_versions").insert({ template_key: templateKey, version, structure, composed_from: blockKeys, changelog, is_published: true, published_at: new Date().toISOString(), created_by: createdBy ?? null });
  await sb.from("program_templates").update({ current_version: version, structure }).eq("key", templateKey);
  await auditService("template.publish", "template_versions", templateKey, { version }, undefined);
  return { version };
}
