"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

function parseItem(formData: FormData) {
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").replace(",", ".").trim();
    return v === "" ? null : Number(v);
  };
  return {
    kind: String(formData.get("kind")),
    brand: String(formData.get("brand")),
    name: String(formData.get("name")),
    description: String(formData.get("description") ?? "") || null,
    unit: String(formData.get("unit") ?? "un"),
    price: num("price"),
    cost: num("cost"),
    active: formData.get("active") === "on",
    needs_review: formData.get("needs_review") === "on",
  };
}

export async function createItem(formData: FormData) {
  const supabase = await createClient();
  const item = parseItem(formData);
  const { data, error } = await supabase.from("catalog_items").insert(item).select("id").single();
  if (error) throw new Error(error.message);
  await audit("catalog.create", "catalog_items", data.id, item);
  revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo");
}

export async function updateItem(id: string, formData: FormData) {
  const supabase = await createClient();
  const item = parseItem(formData);
  const { error } = await supabase.from("catalog_items").update(item).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("catalog.update", "catalog_items", id, item);
  revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo");
}

export async function deleteItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("catalog.delete", "catalog_items", id);
  revalidatePath("/admin/catalogo");
}
