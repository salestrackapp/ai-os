"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { exigirAdmin } from "@/lib/auth";

export async function createTask(input: { title: string; deal_id?: string | null; org_id?: string | null; due_date?: string | null }) {
  await exigirAdmin();
  const title = input.title?.trim();
  if (!title) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let orgId = input.org_id ?? null;
  if (!orgId && input.deal_id) {
    const { data: d } = await supabase.from("deals").select("org_id").eq("id", input.deal_id).single();
    orgId = d?.org_id ?? null;
  }
  const row = { title, deal_id: input.deal_id ?? null, org_id: orgId, due_date: input.due_date || null, created_by: user?.id ?? null };
  const { data, error } = await supabase.from("tasks").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  await audit("task.create", "tasks", data.id, row, orgId ?? undefined);
  revalidatePath("/admin/tarefas");
  revalidatePath("/admin/crm");
  if (input.deal_id) revalidatePath(`/admin/crm/${input.deal_id}`);
}

export async function toggleTask(id: string, done: boolean) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks")
    .update({ done, completed_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("task.toggle", "tasks", id, { done });
  revalidatePath("/admin/tarefas");
  revalidatePath("/admin/crm");
}

export async function deleteTask(id: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("task.delete", "tasks", id);
  revalidatePath("/admin/tarefas");
  revalidatePath("/admin/crm");
}
