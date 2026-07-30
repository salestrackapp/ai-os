import { redirect } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { syncContactToMailerLite } from "@/lib/mailerlite";
import { CrmNav } from "@/components/crm/CrmNav";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

async function importCsv(formData: FormData) {
  "use server";
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const supabase = await createClient();

  const pick = (row: Record<string, string>, keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(row).find((h) => h.trim().toLowerCase() === k);
      if (found && row[found]?.trim()) return row[found].trim();
    }
    return null;
  };

  const orgCache = new Map<string, string>(); // nome(lower) -> id
  const stats = { contactsNew: 0, contactsUpd: 0, dealsNew: 0, dealsUpd: 0, orgsNew: 0 };

  async function findOrCreateOrg(company: string | null): Promise<string | null> {
    if (!company) return null;
    const key = company.toLowerCase();
    if (orgCache.has(key)) return orgCache.get(key)!;
    const { data: existing } = await supabase.from("organizations")
      .select("id").eq("is_salestrack", false).ilike("name", company).limit(1);
    if (existing && existing.length) { orgCache.set(key, existing[0].id); return existing[0].id; }
    const slug = (key.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "org") + "-" + Math.random().toString(36).slice(2, 8);
    const { data: created, error: cErr } = await supabase.from("organizations")
      .insert({ name: company, slug, status: "prospect" }).select("id").single();
    if (cErr || !created) return null;
    orgCache.set(key, created.id); stats.orgsNew++;
    return created.id;
  }

  for (const row of parsed.data) {
    const name = pick(row, ["first name", "nome", "name", "contact name"]);
    const last = pick(row, ["last name", "sobrenome"]);
    const email = pick(row, ["email", "e-mail"]);
    const phone = pick(row, ["phone number", "telefone", "phone", "mobile phone number"]);
    const company = pick(row, ["company name", "empresa", "company", "associated company"]);
    const dealName = pick(row, ["deal name", "negócio", "negocio"]);
    const amount = pick(row, ["amount", "valor"]);
    const fullName = [name, last].filter(Boolean).join(" ") || email || "Sem nome";
    const orgId = await findOrCreateOrg(company);

    // Contato: dedupe por e-mail (atualiza se já existe)
    let contactId: string | null = null;
    if (email) {
      await syncContactToMailerLite({ email, name: fullName, company });
      const { data: found } = await supabase.from("contacts").select("id").eq("email", email).limit(1);
      if (found && found.length) {
        contactId = found[0].id;
        await supabase.from("contacts").update({ name: fullName, phone, org_id: orgId }).eq("id", contactId);
        stats.contactsUpd++;
      } else {
        const { data } = await supabase.from("contacts").insert({ name: fullName, email, phone, org_id: orgId }).select("id").single();
        contactId = data?.id ?? null; stats.contactsNew++;
      }
    } else if (name) {
      const { data } = await supabase.from("contacts").insert({ name: fullName, phone, org_id: orgId }).select("id").single();
      contactId = data?.id ?? null; stats.contactsNew++;
    }

    // Deal: dedupe por título + organização (re-import não duplica)
    if (dealName || company) {
      const title = dealName ?? `${company} · oportunidade`;
      const value = amount ? Number(amount.replace(/[^\d.,]/g, "").replace(",", ".")) || null : null;
      let q = supabase.from("deals").select("id").ilike("title", title);
      q = orgId ? q.eq("org_id", orgId) : q.is("org_id", null);
      const { data: existingDeal } = await q.limit(1);
      if (existingDeal && existingDeal.length) {
        await supabase.from("deals").update({ value_estimated: value, contact_id: contactId, org_id: orgId }).eq("id", existingDeal[0].id);
        stats.dealsUpd++;
      } else {
        await supabase.from("deals").insert({ title, contact_id: contactId, org_id: orgId, stage: "sinal", value_estimated: value });
        stats.dealsNew++;
      }
    }
  }
  await audit("crm.import_hubspot", "deals", undefined, { rows: parsed.data.length, ...stats });
  redirect("/admin/crm");
}

export default function ImportarPage() {
  return (
    <ContentArea>
      <div>
        <p className="text-[13px] uppercase tracking-[.24em] text-muted2 mb-1">Migração · desligamento do HubSpot</p>
        <h1 className="font-serif text-4xl font-semibold mb-6">Importar CSV</h1>
        <CrmNav />
        <form action={importCsv} className="card p-8 space-y-5 max-w-2xl">
          <p className="text-sm text-muted">
            Exporte contatos e negócios do HubSpot em CSV e envie aqui. Colunas reconhecidas:
            <span className="font-mono text-xs text-teal"> First Name, Last Name, Email, Phone Number, Company Name, Deal Name, Amount</span>
            {" "}(e equivalentes em português). Deals entram no estágio <b className="text-cream">Sinal</b>.
          </p>
          <p className="text-sm text-muted">
            <b className="text-cream">Dedupe:</b> contatos são casados por <b>e-mail</b> e deals por <b>título + organização</b> —
            reimportar o mesmo arquivo <b>atualiza</b> em vez de duplicar. Organizações são criadas/vinculadas pela coluna <b>Company</b>.
          </p>
          <input type="file" name="file" accept=".csv" required
            className="block w-full text-sm text-muted file:btn-gold file:mr-4 file:border-0" />
          <button className="btn-gold">Importar e registrar em auditoria</button>
        </form>
      </div>
    </ContentArea>
  );
}
