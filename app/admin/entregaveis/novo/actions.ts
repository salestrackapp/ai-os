"use server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { auditService } from "@/lib/audit";
import { runCopilot } from "@/lib/agents/copilot";
import { tipoDef, isPassoAPasso } from "@/lib/estudio/catalogo";

const token = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.round(Math.random() * 1e9)}`).replace(/-/g, "");

/** Gera um esboço de módulos (passo a passo) via IA; degrada para stubs. */
async function esbocarModulos(titulo: string, tipoLabel: string, contexto: string): Promise<{ titulo: string; objetivo: string }[]> {
  const r = await runCopilot({
    task: `Monte o índice de um ${tipoLabel} intitulado "${titulo}" para o cliente. Liste de 4 a 6 módulos, um por linha, no formato "Título do módulo — objetivo em uma frase". Sem numeração, sem texto extra.`,
    context: contexto, maxTokens: 500,
  });
  if (r.degraded || !r.text) {
    return Array.from({ length: 4 }, (_, i) => ({ titulo: `Módulo ${i + 1}`, objetivo: "" }));
  }
  const linhas = r.text.split(/\r?\n/).map((l) => l.replace(/^[\s\-\d.)]+/, "").trim()).filter(Boolean).slice(0, 6);
  const mods = linhas.map((l) => { const [t, ...o] = l.split(/—|:| - /); return { titulo: (t || "Módulo").trim(), objetivo: o.join(" ").trim() }; });
  return mods.length ? mods : Array.from({ length: 4 }, (_, i) => ({ titulo: `Módulo ${i + 1}`, objetivo: "" }));
}

/** Cria um entregável do catálogo (tipo escolhido), rascunha com IA e — se passo a passo — gera módulos. */
export async function criarEntregavelCatalogoAction(formData: FormData) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) redirect("/admin/entregaveis");

  const orgId = String(formData.get("cliente") ?? "").trim();
  const kind = String(formData.get("kind") ?? "documento").trim();
  const titulo = String(formData.get("titulo") ?? "").trim() || tipoDef(kind).label;
  const etapa = Math.max(1, Math.min(6, Number(formData.get("etapa") ?? 3)));
  const externalUrl = String(formData.get("external_url") ?? "").trim() || null;
  const gerarIA = String(formData.get("gerar_ia") ?? "") === "on";
  if (!orgId) redirect("/admin/entregaveis");

  const def = tipoDef(kind);
  const sb = createServiceClient();
  const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle();
  const { data: proj } = await sb.from("projects").select("id").eq("org_id", orgId).is("deleted_at", null).order("created_at").limit(1).maybeSingle();
  const ctx = `Cliente: ${org?.name ?? ""}. Tipo: ${def.label}. Família: ${def.familia}.`;

  // rascunho de conteúdo (IA) para tipos de leitura única
  let content: Record<string, unknown> = {};
  if (gerarIA && def.consumo === "single") {
    const r = await runCopilot({ task: `Escreva um rascunho pronto de "${titulo}" (${def.label}) para este cliente, no tom da marca Salestrack. Objetivo, sem inventar dados; onde faltar informação, deixe [placeholder].`, context: ctx, maxTokens: 900 });
    if (!r.degraded) content = { html: `<div>${r.text.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</div>`, texto: r.text };
  }

  const { data: del, error } = await sb.from("studio_deliverables").insert({
    org_id: orgId, project_id: proj?.id ?? null, kind, catalog_family: def.familia, template_key: kind,
    title: titulo, source_type: "manual", brand: "salestrack", status: "rascunho", version: 1,
    format: def.formatos[0], content, external_url: externalUrl, phase_index: etapa, public_token: token(),
    created_by: m.userId,
  }).select("id").single();
  if (error || !del) redirect("/admin/entregaveis");

  // módulos (passo a passo)
  if (isPassoAPasso(kind)) {
    const mods = gerarIA ? await esbocarModulos(titulo, def.label, ctx) : Array.from({ length: 4 }, (_, i) => ({ titulo: `Módulo ${i + 1}`, objetivo: "" }));
    await sb.from("studio_modules").insert(mods.map((mod, i) => ({
      deliverable_id: del.id, ordem: i + 1, titulo: mod.titulo, tipo: "texto", conteudo: { objetivo: mod.objetivo },
    })));
  }

  await auditService("studio.criado_catalogo", "studio_deliverables", del.id, { kind, etapa }, orgId);
  redirect(`/admin/entregaveis/${del.id}`);
}
