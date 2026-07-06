"use server";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import { signedArtifactUrl } from "@/lib/deliverables/render";

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
