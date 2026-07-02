import { redirect } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

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

  let contacts = 0, deals = 0;
  for (const row of parsed.data) {
    const name = pick(row, ["first name", "nome", "name", "contact name"]);
    const last = pick(row, ["last name", "sobrenome"]);
    const email = pick(row, ["email", "e-mail"]);
    const phone = pick(row, ["phone number", "telefone", "phone", "mobile phone number"]);
    const company = pick(row, ["company name", "empresa", "company", "associated company"]);
    const dealName = pick(row, ["deal name", "negócio", "negocio"]);
    const amount = pick(row, ["amount", "valor"]);

    let contactId: string | null = null;
    if (name || email) {
      const { data } = await supabase.from("contacts").insert({
        name: [name, last].filter(Boolean).join(" ") || email || "Sem nome",
        email, phone,
      }).select("id").single();
      contactId = data?.id ?? null;
      contacts++;
    }
    if (dealName || company) {
      await supabase.from("deals").insert({
        title: dealName ?? `${company} · oportunidade`,
        contact_id: contactId,
        stage: "sinal",
        value_estimated: amount ? Number(amount.replace(/[^\d.,]/g, "").replace(",", ".")) || null : null,
      });
      deals++;
    }
  }
  await audit("crm.import_hubspot", "deals", undefined, { rows: parsed.data.length, contacts, deals });
  redirect("/admin/crm");
}

export default function ImportarPage() {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Migração · desligamento do HubSpot</p>
      <h1 className="font-serif text-4xl font-semibold mb-8">Importar CSV</h1>
      <form action={importCsv} className="card p-8 space-y-5">
        <p className="text-sm text-muted">
          Exporte contatos e negócios do HubSpot em CSV e envie aqui. Colunas reconhecidas:
          <span className="font-mono text-xs text-teal"> First Name, Last Name, Email, Phone Number, Company Name, Deal Name, Amount</span>
          {" "}(e equivalentes em português). Deals entram no estágio <b className="text-cream">Sinal</b>.
        </p>
        <input type="file" name="file" accept=".csv" required
          className="block w-full text-sm text-muted file:btn-gold file:mr-4 file:border-0" />
        <button className="btn-gold">Importar e registrar em auditoria</button>
      </form>
    </div>
  );
}
