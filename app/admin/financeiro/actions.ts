"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

const num = (v: FormDataEntryValue | null) => { const s = String(v ?? "").replace(/[^\d.,]/g, "").replace(",", "."); return s ? Number(s) : null; };

export async function createManualInvoice(formData: FormData) {
  const supabase = await createClient();
  const row = {
    org_id: String(formData.get("org_id") ?? "") || null,
    kind: String(formData.get("kind") ?? "mensalidade"),
    amount: num(formData.get("amount")),
    due_date: String(formData.get("due_date") ?? "") || null,
    installment_n: formData.get("installment_n") ? Number(formData.get("installment_n")) : null,
    installments_total: formData.get("installments_total") ? Number(formData.get("installments_total")) : null,
    status: "aberta",
  };
  if (!row.org_id) throw new Error("Selecione a conta.");
  const { data, error } = await supabase.from("invoices").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  await audit("invoice.create_manual", "invoices", data.id, row, row.org_id);
  revalidatePath("/admin/financeiro");
}

export async function markInvoicePaid(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ status: "paga", paid_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("invoice.paid", "invoices", id);
  revalidatePath("/admin/financeiro");
}

export async function createManualSubscription(formData: FormData) {
  const supabase = await createClient();
  const row = {
    org_id: String(formData.get("org_id") ?? "") || null,
    plan: String(formData.get("plan") ?? "professional"),
    monthly_amount: num(formData.get("monthly_amount")),
    status: "ativa",
  };
  if (!row.org_id) throw new Error("Selecione a conta.");
  const { data, error } = await supabase.from("subscriptions").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  await audit("subscription.create_manual", "subscriptions", data.id, row, row.org_id);
  revalidatePath("/admin/financeiro");
}

export async function cancelSubscription(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").update({ status: "cancelada" }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("subscription.cancel", "subscriptions", id);
  revalidatePath("/admin/financeiro");
}
