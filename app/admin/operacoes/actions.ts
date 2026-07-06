"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rollupAiCost } from "@/lib/finops/cost";
import { computeTenantHealth } from "@/lib/ops/health";
import { scanAlerts } from "@/lib/ops/alerts";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
}

/** Roda os jobs de observabilidade agora (rollup custo + saúde + alertas). */
export async function runOpsNow() {
  await requireAdmin();
  const day = new Date().toISOString().slice(0, 10);
  await rollupAiCost(day);
  await computeTenantHealth(day);
  await scanAlerts();
  await audit("ops.run", "tenant_health", undefined, { day }, undefined);
  revalidatePath("/admin/operacoes");
}

export async function ackAlert(id: string) {
  await requireAdmin();
  const sb = await createClient();
  await sb.from("alerts").update({ status: "reconhecido" }).eq("id", id);
  revalidatePath("/admin/operacoes");
}
export async function resolveAlert(id: string) {
  await requireAdmin();
  const sb = await createClient();
  await sb.from("alerts").update({ status: "resolvido", resolved_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/operacoes");
}

export async function saveModelPrice(id: string, formData: FormData) {
  await requireAdmin();
  const sb = await createClient();
  await sb.from("model_prices").update({
    price_in_per_mtok: Number(String(formData.get("price_in") ?? "0")) || 0,
    price_out_per_mtok: Number(String(formData.get("price_out") ?? "0")) || 0,
  }).eq("id", id);
  await audit("model_price.save", "model_prices", id, null, undefined);
  revalidatePath("/admin/operacoes");
}
