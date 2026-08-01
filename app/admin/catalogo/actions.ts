"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { exigirAdmin } from "@/lib/auth";

function parseItem(formData: FormData) {
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").replace(",", ".").trim();
    return v === "" ? null : Number(v);
  };
  const frentes = formData.getAll("frentes").map(String).map((s) => s.trim()).filter(Boolean);
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
    frentes,
    internal_notes: String(formData.get("internal_notes") ?? "") || null,
  };
}

export async function createItem(formData: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const item = parseItem(formData);
  const { data, error } = await supabase.from("catalog_items").insert(item).select("id").single();
  if (error) throw new Error(error.message);
  await audit("catalog.create", "catalog_items", data.id, item);
  revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo");
}

export async function updateItem(id: string, formData: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const item = parseItem(formData);
  const { error } = await supabase.from("catalog_items").update(item).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("catalog.update", "catalog_items", id, item);
  revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo");
}

export async function deleteItem(id: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("catalog.delete", "catalog_items", id);
  revalidatePath("/admin/catalogo");
}

export async function duplicateItem(id: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { data: it } = await supabase.from("catalog_items").select("*").eq("id", id).single();
  if (!it) return;
  const copy = {
    kind: it.kind, brand: it.brand, name: `${it.name} (cópia)`, description: it.description,
    unit: it.unit, price: it.price, cost: it.cost, active: it.active,
    needs_review: true, frentes: it.frentes ?? [], internal_notes: it.internal_notes,
  };
  const { data, error } = await supabase.from("catalog_items").insert(copy).select("id").single();
  if (error) throw new Error(error.message);
  await audit("catalog.duplicate", "catalog_items", data.id, { from: id });
  revalidatePath("/admin/catalogo");
}

export async function bulkSetActive(ids: string[], active: boolean) {
  await exigirAdmin();
  if (!ids.length) return;
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").update({ active }).in("id", ids);
  if (error) throw new Error(error.message);
  await audit("catalog.bulk_active", "catalog_items", undefined, { ids, active });
  revalidatePath("/admin/catalogo");
}

export async function bulkMarkReviewed(ids: string[]) {
  await exigirAdmin();
  if (!ids.length) return;
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").update({ needs_review: false }).in("id", ids);
  if (error) throw new Error(error.message);
  await audit("catalog.bulk_reviewed", "catalog_items", undefined, { ids });
  revalidatePath("/admin/catalogo");
}
