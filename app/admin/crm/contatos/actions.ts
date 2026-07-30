"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { syncContactToMailerLite } from "@/lib/mailerlite";
import { apolloEnrichPerson, mergePreservandoExistente } from "@/lib/apollo";

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
  await syncContactToMailerLite({ email: c.email, name: c.name });
  revalidatePath("/admin/crm/contatos");
}

export async function updateContact(id: string, formData: FormData) {
  const supabase = await createClient();
  const c = parse(formData);
  const { error } = await supabase.from("contacts").update(c).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("contact.update", "contacts", id, c);
  await syncContactToMailerLite({ email: c.email, name: c.name });
  revalidatePath("/admin/crm/contatos");
}

/**
 * Enriquece um contato pelo Apollo. Consome crédito.
 * Nunca sobrescreve o que já está preenchido — dado digitado por uma pessoa sempre vence.
 */
export async function enrichContact(id: string) {
  const supabase = await createClient();
  const { data: c } = await supabase.from("contacts")
    .select("id, org_id, name, email, phone, role, linkedin_url, apollo_id").eq("id", id).single();
  if (!c) throw new Error("Contato não encontrado.");

  let companyName: string | undefined;
  if (c.org_id) {
    const { data: org } = await supabase.from("organizations").select("name").eq("id", c.org_id).maybeSingle();
    companyName = org?.name;
  }
  const [firstName, ...rest] = String(c.name).trim().split(/\s+/);
  const found = await apolloEnrichPerson({
    firstName, lastName: rest.join(" ") || undefined,
    email: c.email ?? undefined, companyName,
  });
  if (!found) throw new Error("Apollo não retornou dados (sem chave, sem correspondência ou fora do ar).");

  const patch = mergePreservandoExistente(c as unknown as Record<string, unknown>, {
    email: found.email, phone: found.phone, role: found.title,
    linkedin_url: found.linkedin_url, apollo_id: found.apollo_id,
  });
  if (Object.keys(patch).length === 0) throw new Error("Nada a preencher: o contato já tem todos os dados que o Apollo trouxe.");

  const { error } = await supabase.from("contacts").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("contact.enrich_apollo", "contacts", id, { campos: Object.keys(patch) }, c.org_id ?? undefined);
  revalidatePath("/admin/crm/contatos");
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("contact.delete", "contacts", id);
  revalidatePath("/admin/crm/contatos");
}
