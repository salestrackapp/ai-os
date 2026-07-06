"use server";
import { revalidatePath } from "next/cache";
import { currentMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { sendGmail, googleConfigured } from "@/lib/google";
import { auditService } from "@/lib/audit";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}

/**
 * Envia um e-mail de ativação/relacionamento pela SUA caixa do Gmail (conta Salestrack),
 * amarrado ao cliente (org). PII só no envio; registro sem o corpo. Graceful sem config.
 */
export async function sendClientEmail(orgId: string, formData: FormData) {
  await requireAdmin();
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim() || "(sem assunto)";
  const body = String(formData.get("body") ?? "").trim();
  if (!to || !body) throw new Error("Preencha destinatário e mensagem.");

  if (!(await googleConfigured())) {
    await auditService("email.manual", "contacts", to, { orgId, subject, reason: "gmail_nao_configurado" }, orgId);
    revalidatePath(`/admin/clientes/${orgId}/caixa`);
    return;
  }
  // corpo em texto simples com quebras → HTML leve (parágrafos)
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">${body.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
  const r = await sendGmail(to, subject, html, { html: true });
  await auditService(r.sent ? "email.sent" : "email.failed", "contacts", to, { orgId, subject, id: r.id ?? null }, orgId);
  revalidatePath(`/admin/clientes/${orgId}/caixa`);
}
