"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { DEAL_STAGES } from "@/lib/types";

export async function moveDeal(id: string, direction: "next" | "prev") {
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("stage").eq("id", id).single();
  if (!deal) return;
  const idx = DEAL_STAGES.indexOf(deal.stage as (typeof DEAL_STAGES)[number]);
  if (idx === -1) return;
  const next = direction === "next" ? Math.min(idx + 1, DEAL_STAGES.length - 1) : Math.max(idx - 1, 0);
  if (next === idx) return;
  const stage = DEAL_STAGES[next];
  await supabase.from("deals").update({ stage }).eq("id", id);
  await audit("deal.stage_change", "deals", id, { from: deal.stage, to: stage });
  revalidatePath("/admin/crm");
}

export async function createDeal(formData: FormData) {
  const supabase = await createClient();
  const deal = {
    title: String(formData.get("title")),
    icp: formData.get("icp") ? Number(formData.get("icp")) : null,
    brand: String(formData.get("brand") ?? "andre_kachan"),
    score: formData.get("score") ? Number(formData.get("score")) : 0,
    value_estimated: formData.get("value") ? Number(String(formData.get("value")).replace(",", ".")) : null,
    stage: "sinal",
  };
  const { data, error } = await supabase.from("deals").insert(deal).select("id").single();
  if (error) throw new Error(error.message);
  await audit("deal.create", "deals", data.id, deal);
  revalidatePath("/admin/crm");
}
