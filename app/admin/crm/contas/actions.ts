"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

function slugify(name: string, seed: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + seed.slice(0, 6);
}

export async function createOrg(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome é obrigatório.");
  const org = {
    name,
    cnpj: String(formData.get("cnpj") ?? "").trim() || null,
    plan: String(formData.get("plan") ?? "professional"),
    status: String(formData.get("status") ?? "prospect"),
    icp: formData.get("icp") ? Number(formData.get("icp")) : null,
  };
  const { data, error } = await supabase.from("organizations").insert(org).select("id").single();
  if (error) throw new Error(error.message);
  await supabase.from("organizations").update({ slug: slugify(name, data.id) }).eq("id", data.id);
  await audit("org.create", "organizations", data.id, org);
  revalidatePath("/admin/crm/contas");
  redirect(`/admin/crm/contas/${data.id}`);
}

export async function updateOrg(id: string, formData: FormData) {
  const supabase = await createClient();
  const org = {
    name: String(formData.get("name") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim() || null,
    plan: String(formData.get("plan") ?? "professional"),
    status: String(formData.get("status") ?? "prospect"),
    icp: formData.get("icp") ? Number(formData.get("icp")) : null,
  };
  const { error } = await supabase.from("organizations").update(org).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("org.update", "organizations", id, org);
  revalidatePath("/admin/crm/contas");
  revalidatePath(`/admin/crm/contas/${id}`);
}

export async function deleteOrg(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("org.delete", "organizations", id);
  revalidatePath("/admin/crm/contas");
  redirect("/admin/crm/contas");
}
