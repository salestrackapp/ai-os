import { createClient } from "@/lib/supabase/server";
import { CrmNav } from "@/components/crm/CrmNav";
import { ContactsManager } from "@/components/crm/ContactsManager";
import type { Contact, Organization } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContatosPage() {
  const supabase = await createClient();
  const [{ data: contacts }, { data: orgs }] = await Promise.all([
    supabase.from("contacts").select("*").order("name"),
    supabase.from("organizations").select("*").eq("is_salestrack", false).order("name"),
  ]);

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">CRM · Pessoas</p>
      <h1 className="font-serif text-4xl font-semibold mb-6">Contatos</h1>
      <CrmNav />
      <ContactsManager contacts={(contacts as Contact[]) ?? []} orgs={(orgs as Organization[]) ?? []} />
    </div>
  );
}
