import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { signedArtifactUrl } from "@/lib/deliverables/render";

export const dynamic = "force-dynamic";

/** Link seguro de compartilhamento — fora do guard, só o artefato do token (padrão da proposta/segurança). */
export default async function PublicDeliverable({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = createServiceClient();
  const { data: d } = await sb.from("studio_deliverables").select("rendered_url, status").eq("public_token", token).maybeSingle();
  if (!d || !["aprovado", "entregue"].includes(d.status) || !d.rendered_url) notFound();
  const url = await signedArtifactUrl(d.rendered_url, false);
  if (!url) notFound();
  redirect(url);
}
