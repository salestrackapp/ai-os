"use client";
import { useState, useMemo } from "react";
import type { Organization, Contact } from "@/lib/types";
import { createDeal } from "@/app/admin/crm/actions";

export function NewDealForm({ orgs, contacts }: { orgs: Organization[]; contacts: Contact[] }) {
  const [orgId, setOrgId] = useState("");
  const options = useMemo(
    () => contacts.filter((c) => (orgId ? c.org_id === orgId : c.org_id === null)),
    [contacts, orgId]
  );
  return (
    <form action={createDeal} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-52"><label className="label">Novo deal</label>
        <input className="input" name="title" placeholder="Empresa · oportunidade" required /></div>
      <div className="w-44"><label className="label">Conta</label>
        <select className="input" name="org_id" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">— nenhuma —</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select></div>
      <div className="w-44"><label className="label">Contato</label>
        <select key={orgId} className="input" name="contact_id" defaultValue="">
          <option value="">— nenhum —</option>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
      <div className="w-20"><label className="label">ICP</label>
        <select className="input" name="icp"><option value="">—</option><option>1</option><option>2</option><option>3</option></select></div>
      <div className="w-28"><label className="label">Valor est.</label>
        <input className="input font-mono" name="value" placeholder="R$" /></div>
      <div className="w-40"><label className="label">Marca</label>
        <select className="input" name="brand">
          <option value="andre_kachan">André Kachan</option>
          <option value="salestrack">Salestrack AI</option>
          <option value="ai_os">AI OS</option>
        </select></div>
      <button className="btn-gold">Adicionar</button>
    </form>
  );
}
