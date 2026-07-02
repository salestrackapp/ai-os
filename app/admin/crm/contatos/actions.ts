"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    role: String(formData.get("role") ?? "").trim() || null,
    org_id: String(formData.get("org_id") ?? "").trim() || null,
    opt_in_whatsapp: formData.get("opt_in_whatsapp") === "on",
  };
}

export async function createContact(formData: FormData) {
  const supabase = await createClient();
  const c = parse(formData);
  if (!c.name) throw new Error("Nome é obrigatório.");
  const { data, error } = await supabase.from("contacts").insert(c).select("id").single();
  if (error) throw new Error(error.message);
  await audit("contact.create", "contacts", data.id, c);
  revalidatePath("/admin/crm/contatos");
}

export async function updateContact(id: string, formData: FormData) {
  const supabase = await createClient();
  const c = parse(formData);
  const { error } = await supabase.from("contacts").update(c).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("contact.update", "contacts", id, c);
  revalidatePath("/admin/crm/contatos");
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("contact.delete", "contacts", id);
  revalidatePath("/admin/crm/contatos");
}
