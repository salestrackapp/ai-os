import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { notifyAdmin } from "@/lib/whatsapp";
import { brl } from "@/lib/types";

function validStripeSig(raw: string, header: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")));
  const t = parts["t"], v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`, "utf8").digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1)); } catch { return false; }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validStripeSig(raw, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let evt: { type?: string; data?: { object?: Record<string, unknown> } } = {};
  try { evt = JSON.parse(raw); } catch { /* ignore */ }
  const type = evt.type ?? "";
  const obj = evt.data?.object ?? {};
  const sb = createServiceClient();

  if (type === "invoice.paid") {
    await sb.from("invoices").update({ status: "paga", paid_at: new Date().toISOString() }).eq("stripe_invoice_id", String(obj.id));
  } else if (type === "invoice.payment_failed") {
    const { data: inv } = await sb.from("invoices").select("org_id, amount").eq("stripe_invoice_id", String(obj.id)).single();
    let orgName = "cliente";
    if (inv?.org_id) { const { data: o } = await sb.from("organizations").select("name").eq("id", inv.org_id).single(); orgName = o?.name ?? orgName; }
    await auditService("invoice.payment_failed", "invoices", String(obj.id), obj, inv?.org_id ?? undefined);
    await notifyAdmin(`⚠️ Fatura em atraso: ${orgName} · ${brl(inv?.amount ?? (Number(obj.amount_due) || 0) / 100)}`);
  } else if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    const status = type === "customer.subscription.deleted" ? "cancelada" : (obj.status === "active" ? "ativa" : String(obj.status ?? "ativa"));
    await sb.from("subscriptions").update({ status }).eq("stripe_subscription_id", String(obj.id));
  }
  return NextResponse.json({ received: true });
}
