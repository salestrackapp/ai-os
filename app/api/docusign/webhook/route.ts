import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { notifyAdmin } from "@/lib/whatsapp";
import { downloadSignedPdf } from "@/lib/docusign";
import { runKickoff } from "@/lib/kickoff";
import { avisarContratoAssinado } from "@/lib/notifications/eventos";

function validHmac(raw: string, header: string | null): boolean {
  const secret = process.env.DOCUSIGN_CONNECT_SECRET;
  if (!secret) return false;
  if (!header) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header)); } catch { return false; }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validHmac(raw, req.headers.get("x-docusign-signature-1"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw); } catch { /* ignore */ }
  const event = String(body.event ?? "");
  const data = (body.data ?? {}) as Record<string, unknown>;
  const envelopeId = String(data.envelopeId ?? (body as Record<string, unknown>).envelopeId ?? "");
  if (!envelopeId) return NextResponse.json({ ok: true });

  const sb = createServiceClient();
  const { data: c } = await sb.from("contracts").select("*").eq("docusign_envelope_id", envelopeId).single();
  if (!c) return NextResponse.json({ ok: true });

  if (event === "envelope-completed" && c.status !== "assinado") {
    try {
      const pdf = await downloadSignedPdf(envelopeId);
      const hash = crypto.createHash("sha256").update(Buffer.from(pdf)).digest("hex");
      const path = `${c.org_id ?? "sem-org"}/${c.id}.pdf`;
      await sb.storage.from("contratos").upload(path, pdf, { contentType: "application/pdf", upsert: true });
      await sb.from("contracts").update({ status: "assinado", signed_at: new Date().toISOString(), signed_pdf_url: path, content_hash: hash }).eq("id", c.id).neq("status", "assinado");
      await sb.from("contract_events").insert({ contract_id: c.id, kind: "assinado", payload: { envelopeId, hash } });
      await auditService("contract.signed", "contracts", c.id, { envelopeId, hash }, c.org_id ?? undefined);
      await notifyAdmin(`✅ Contrato assinado (Docusign): ${c.signer_name ?? ""}. Iniciando kickoff…`);
      await avisarContratoAssinado({ contratoId: c.id as string, signatario: c.signer_name as string | null, orgId: c.org_id as string | null });
      await runKickoff(c.id);
    } catch (e) {
      await sb.from("contract_events").insert({ contract_id: c.id, kind: "kickoff_erro", payload: { error: (e as Error).message } });
    }
  } else if (event === "recipient-declined") {
    await sb.from("contracts").update({ status: "cancelado" }).eq("id", c.id);
    await sb.from("contract_events").insert({ contract_id: c.id, kind: "recusado", payload: data });
    await auditService("contract.declined", "contracts", c.id, data, c.org_id ?? undefined);
    await notifyAdmin(`❌ Contrato recusado no Docusign: ${c.signer_name ?? ""}.`);
  }
  return NextResponse.json({ ok: true });
}
