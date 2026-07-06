"use server";
import { revalidatePath } from "next/cache";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { runCopilot } from "@/lib/agents/copilot";

function canEdit(role: string | null, isAdmin: boolean) { return isAdmin || role === "client_admin"; }

export async function saveGovernance(formData: FormData) {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId || !canEdit(m.role, m.isAdmin)) throw new Error("Sem permissão.");
  const svc = createServiceClient();
  await svc.from("governance_policies").upsert({
    org_id: m.orgId,
    policy_md: String(formData.get("policy_md") ?? "").trim() || null,
    security_summary_md: String(formData.get("security_summary_md") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "org_id" });
  await auditService("governance.save", "governance_policies", undefined, null, m.orgId);
  revalidatePath("/portal/governanca");
}

/** Rascunha a política + resumo de segurança por IA, a partir do stack declarado. Sempre revisar. */
export async function draftGovernanceAI() {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId || !canEdit(m.role, m.isAdmin)) throw new Error("Sem permissão.");
  const svc = createServiceClient();
  const [{ data: org }, { data: stack }] = await Promise.all([
    svc.from("organizations").select("name").eq("id", m.orgId).single(),
    svc.from("ai_stack_entries").select("platform_name, purpose, data_classification, authorized_data").eq("org_id", m.orgId),
  ]);
  const ctx = `Empresa: ${org?.name ?? "cliente"}\nStack de IA declarado:\n${(stack ?? []).map((s) => `- ${s.platform_name} (${s.data_classification}): ${s.purpose ?? ""} — autorizado a receber: ${s.authorized_data ?? "n/d"}`).join("\n") || "nenhum registrado"}`;
  const r = await runCopilot({
    context: ctx, maxTokens: 1600,
    task: "Rascunhe uma Política de Uso de IA da empresa e um Resumo de Segurança (público, para comitê de risco de clientes). Baseie-se no stack declarado. Responda em duas seções separadas EXATAMENTE por uma linha '=== RESUMO PÚBLICO ===': primeiro a POLÍTICA completa (markdown), depois o RESUMO PÚBLICO curto (markdown). Não invente ferramentas fora do stack.",
  });
  if (r.degraded) throw new Error("IA indisponível.");
  const [policy, resumo] = r.text.split(/===\s*RESUMO PÚBLICO\s*===/i);
  await svc.from("governance_policies").upsert({
    org_id: m.orgId,
    policy_md: (policy ?? r.text).trim(),
    security_summary_md: (resumo ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "org_id" });
  await auditService("governance.ai_draft", "governance_policies", undefined, null, m.orgId);
  revalidatePath("/portal/governanca");
}

/** Publica/despublica (ação humana explícita). */
export async function publishGovernance(next: boolean) {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId || !canEdit(m.role, m.isAdmin)) throw new Error("Sem permissão.");
  const svc = createServiceClient();
  await svc.from("governance_policies").upsert({ org_id: m.orgId, published: next, published_at: next ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
  await auditService(next ? "governance.publish" : "governance.unpublish", "governance_policies", undefined, null, m.orgId);
  revalidatePath("/portal/governanca");
}
