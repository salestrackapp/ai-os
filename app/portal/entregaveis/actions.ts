"use server";
import { revalidatePath } from "next/cache";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { signedArtifactUrl } from "@/lib/deliverables/render";

/** Aceite da entrega pelo cliente (registro/auditoria; não é o portão do admin). Escopo da própria org. */
export async function aceitarEntregaAction(deliverableId: string) {
  const ctx = await resolvePortalOrg();
  if (!ctx?.orgId) return;
  const sb = createServiceClient();
  const { data: d } = await sb.from("studio_deliverables").select("id, org_id").eq("id", deliverableId).maybeSingle();
  if (!d || d.org_id !== ctx.orgId) return;
  await auditService("portal.entrega_aceita", "studio_deliverables", d.id, { por: ctx.email }, ctx.orgId);
  revalidatePath("/portal/entregaveis");
}

/** Baixa/visualiza um entregável da PRÓPRIA org (aprovado/entregue). Verifica posse antes de assinar. */
export async function portalDownload(id: string): Promise<string> {
  const m = await resolvePortalOrg();
  const orgId = m?.orgId;
  if (!orgId) throw new Error("Sem acesso.");
  const sb = createServiceClient();
  const { data } = await sb.from("studio_deliverables").select("rendered_url, org_id, status").eq("id", id).maybeSingle();
  if (!data || data.org_id !== orgId || !["aprovado", "entregue"].includes(data.status) || !data.rendered_url) throw new Error("Entregável indisponível.");
  const url = await signedArtifactUrl(data.rendered_url, true);
  if (!url) throw new Error("Falha ao gerar link.");
  return url;
}
