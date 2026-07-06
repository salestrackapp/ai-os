"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { publishTemplateVersion } from "@/lib/templates/compile";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}

/** Compõe uma nova versão de um template a partir dos blocos selecionados e publica. */
export async function publishAction(formData: FormData) {
  const m = await requireAdmin();
  const templateKey = String(formData.get("template_key") ?? "").trim();
  const blocks = formData.getAll("blocks").map(String).filter(Boolean);
  const changelog = String(formData.get("changelog") ?? "").trim() || null;
  if (!templateKey) throw new Error("Escolha um template.");
  const { version } = await publishTemplateVersion(templateKey, blocks, changelog ?? "", m.userId);
  await audit("template.publish_ui", "program_templates", templateKey, { version, blocks: blocks.length }, undefined);
  revalidatePath("/admin/biblioteca-templates");
}

/** Duplica um template (clona structure + vertical) com uma nova key. */
export async function duplicateTemplate(srcKey: string, formData: FormData) {
  await requireAdmin();
  const sb = await createClient();
  const newKey = String(formData.get("new_key") ?? "").trim();
  const newName = String(formData.get("new_name") ?? "").trim();
  if (!newKey || !newName) throw new Error("Nova chave e nome são obrigatórios.");
  const { data: src } = await sb.from("program_templates").select("*").eq("key", srcKey).single();
  if (!src) throw new Error("Template origem não encontrado.");
  const { error } = await sb.from("program_templates").insert({ key: newKey, name: newName, description: src.description, vertical_key: src.vertical_key, structure: src.structure, current_version: 1, is_active: true });
  if (error) throw new Error(error.message);
  await sb.from("template_versions").insert({ template_key: newKey, version: 1, structure: src.structure, composed_from: [], is_published: true, published_at: new Date().toISOString() });
  await audit("template.duplicate", "program_templates", newKey, { from: srcKey }, undefined);
  revalidatePath("/admin/biblioteca-templates");
}

export async function toggleTemplate(key: string, next: boolean) {
  await requireAdmin();
  const sb = await createClient();
  await sb.from("program_templates").update({ is_active: next }).eq("key", key);
  revalidatePath("/admin/biblioteca-templates");
}
