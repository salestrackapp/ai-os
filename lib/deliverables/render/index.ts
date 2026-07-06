import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import type { RenderInput, DeliverableContent, BrandScope, DeliverableFormat, DeliverableKind, TenantBrand } from "../types";
import { buildDeliverableHtml } from "./html";
import { htmlToPdf } from "./pdf";
import { htmlToPptx } from "./pptx";
import { htmlToDocx } from "./docx";

const BUCKET = "entregaveis";

const EXT: Record<string, { ext: string; ct: string }> = {
  pdf: { ext: "pdf", ct: "application/pdf" },
  pptx: { ext: "pptx", ct: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  docx: { ext: "docx", ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  html: { ext: "html", ct: "text/html; charset=utf-8" },
};

/** Renderiza um entregável no formato alvo, sobe ao bucket privado e grava versão imutável. */
export async function renderDeliverable(deliverableId: string, actorId?: string | null): Promise<{ ok: boolean; format: DeliverableFormat; degraded: boolean; path: string }> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("*").eq("id", deliverableId).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  const { data: tpl } = await sb.from("deliverable_templates").select("brand_scope, format").eq("key", dv.template_key).maybeSingle();

  // R3.1: a MARCA do entregável (por linha) manda; template é fallback (Fase B).
  const brand_scope = (dv.brand ?? tpl?.brand_scope ?? "salestrack") as BrandScope;
  let requested = (dv.format ?? tpl?.format ?? "pdf") as DeliverableFormat;

  let branding: TenantBrand | null = null;
  if (brand_scope === "tenant") {
    const { data: b } = await sb.from("tenant_branding").select("internal_name, logo_url, color_primary, color_accent, color_bg, level").eq("org_id", dv.org_id).maybeSingle();
    branding = b ?? null;
  }

  // R3.2 · identidade leve do programa (logo/nome/capa/accent-v2). Design continua sempre v2.
  let accent: string | null = null, logo: string | null = null, programName: string | null = null;
  if (dv.project_id) {
    const { data: idn } = await sb.from("programa_identidade").select("accent, client_logo, program_name").eq("program_id", dv.project_id).eq("active", true).is("deleted_at", null).maybeSingle();
    if (idn) { accent = idn.accent; logo = idn.client_logo; programName = idn.program_name; }
  }

  const input: RenderInput = { kind: dv.kind as DeliverableKind, brand_scope, format: requested, content: (dv.content ?? { cover: { title: dv.title } }) as DeliverableContent, branding, title: dv.title, accent, logo, programName };
  const html = buildDeliverableHtml(input);

  let buffer: Buffer;
  let degraded = false;
  if (requested === "pdf") {
    const pdf = await htmlToPdf(html);
    if (pdf) buffer = pdf;
    else { buffer = Buffer.from(html, "utf-8"); requested = "html"; degraded = true; } // degradação graciosa: HTML print-ready
  } else if (requested === "pptx") {
    buffer = await htmlToPptx(input);
  } else if (requested === "docx") {
    buffer = await htmlToDocx(input);
  } else {
    buffer = Buffer.from(html, "utf-8");
  }

  const version = (dv.version ?? 1);
  const meta = EXT[requested];
  const path = `${dv.org_id}/${dv.id}/v${version}.${meta.ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, buffer, { contentType: meta.ct, upsert: true });
  if (up.error) throw new Error(`Falha ao gravar artefato: ${up.error.message}`);

  await sb.from("studio_deliverables").update({ rendered_url: path, format: requested }).eq("id", dv.id);
  await sb.from("studio_deliverable_versions").upsert(
    { deliverable_id: dv.id, version, content_snapshot: dv.content ?? {}, rendered_url: path, created_by: actorId ?? null },
    { onConflict: "deliverable_id,version" },
  );
  await auditService("deliverable.render", "studio_deliverables", dv.id, { format: requested, version, degraded }, dv.org_id);
  return { ok: true, format: requested, degraded, path };
}

/** URL assinada (1h) para baixar/visualizar um artefato do bucket privado. */
export async function signedArtifactUrl(path: string, download = false): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download: true } : undefined);
  return data?.signedUrl ?? null;
}
