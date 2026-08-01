"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { exigirAdmin } from "@/lib/auth";

export async function createSignal(formData: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const s = {
    label: String(formData.get("label") ?? "").trim(),
    weight: Number(formData.get("weight") ?? 5) || 5,
    sort: Number(formData.get("sort") ?? 0) || 0,
  };
  if (!s.label) throw new Error("Rótulo é obrigatório.");
  const { data, error } = await supabase.from("signal_definitions").insert(s).select("id").single();
  if (error) throw new Error(error.message);
  await audit("signal.create", "signal_definitions", data.id, s);
  revalidatePath("/admin/configuracoes/sinais");
}

export async function updateSignal(id: string, formData: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const s = {
    label: String(formData.get("label") ?? "").trim(),
    weight: Number(formData.get("weight") ?? 5) || 0,
    sort: Number(formData.get("sort") ?? 0) || 0,
    active: formData.get("active") === "on",
  };
  const { error } = await supabase.from("signal_definitions").update(s).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("signal.update", "signal_definitions", id, s);
  revalidatePath("/admin/configuracoes/sinais");
}

export async function deleteSignal(id: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("signal_definitions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("signal.delete", "signal_definitions", id);
  revalidatePath("/admin/configuracoes/sinais");
}
