import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { notifyAdmin } from "@/lib/whatsapp";
import { emailAdmin } from "@/lib/email";
import { brl } from "@/lib/types";
import { getProviderConfig } from "@/lib/settings/secrets";

/**
 * Webhook ASAAS — configurar no painel ASAAS apontando para esta rota,
 * com token de autenticação (header asaas-access-token) = Console asaas.webhook_token → env ASAAS_WEBHOOK_TOKEN.
 * Eventos tratados: PAYMENT_RECEIVED/CONFIRMED (paga), PAYMENT_OVERDUE (atraso → alerta).
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("asaas-access-token");
  const expected = (await getProviderConfig("asaas")).webhook_token || process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const event = String(body?.event ?? "");
  const payment = body?.payment ?? {};
  const asaasId = String(payment?.id ?? "");
  if (!asaasId) return NextResponse.json({ ok: true });

  const sb = createServiceClient();
  // procura pela referência gravada (stripe_invoice_id reutilizado como provider_ref genérico)
  const { data: inv } = await sb.from("invoices").select("id, org_id, amount").eq("stripe_invoice_id", asaasId).limit(1).single();

  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    if (inv) await sb.from("invoices").update({ status: "paga", paid_at: new Date().toISOString() }).eq("id", inv.id);
    // assinatura mensal: cria/marca fatura recorrente como paga (registro leve)
    await auditService("invoice.paid_asaas", "invoices", inv?.id ?? asaasId, { event, asaasId }, inv?.org_id ?? undefined);
  } else if (event === "PAYMENT_OVERDUE") {
    if (inv) await sb.from("invoices").update({ status: "atrasada" }).eq("id", inv.id);
    let orgName = "cliente";
    if (inv?.org_id) { const { data: o } = await sb.from("organizations").select("name").eq("id", inv.org_id).single(); orgName = o?.name ?? orgName; }
    const valor = brl(inv?.amount ?? Number(payment?.value) ?? 0);
    await auditService("invoice.overdue_asaas", "invoices", inv?.id ?? asaasId, { event, asaasId }, inv?.org_id ?? undefined);
    await notifyAdmin(`⚠️ Fatura em atraso (ASAAS): ${orgName} · ${valor}`);
    await emailAdmin(`⚠️ Fatura em atraso — ${orgName}`, "Fatura em atraso", `<p><b>${orgName}</b> está com fatura em atraso no valor de <b>${valor}</b> (ASAAS).</p>`);
  }
  return NextResponse.json({ ok: true });
}
