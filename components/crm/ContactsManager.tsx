"use client";
import { useState, useMemo } from "react";
import type { Contact, Organization } from "@/lib/types";
import { createContact, updateContact, deleteContact } from "@/app/admin/crm/contatos/actions";

export function ContactsManager({ contacts, orgs }: { contacts: Contact[]; orgs: Organization[] }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const orgName = useMemo(() => Object.fromEntries(orgs.map((o) => [o.id, o.name])), [orgs]);

  const filtered = useMemo(() => contacts.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.email ?? "").toLowerCase().includes(q.toLowerCase())
  ), [contacts, q]);

  const cur = editing === "new" ? null : editing;

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail…" />
        <button className="btn-gold shrink-0" onClick={() => setEditing("new")}>+ Novo contato</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Nome</th><th className="th">E-mail</th><th className="th">Telefone</th>
            <th className="th">Organização</th><th className="th">WhatsApp</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-navy3/50">
                <td className="td text-cream">{c.name}{c.role && <span className="text-xs text-muted2"> · {c.role}</span>}</td>
                <td className="td text-muted">{c.email ?? "—"}</td>
                <td className="td font-mono text-xs text-muted">{c.phone ?? "—"}</td>
                <td className="td text-muted">{c.org_id ? (orgName[c.org_id] ?? "—") : "—"}</td>
                <td className="td">{c.opt_in_whatsapp ? <span className="badge-teal">opt-in</span> : <span className="badge-muted">—</span>}</td>
                <td className="td text-right"><button className="text-gold text-sm hover:underline" onClick={() => setEditing(c)}>Editar</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td className="td text-muted2" colSpan={6}>Nenhum contato{q ? " para a busca" : ""}.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md h-full bg-navy2 border-l border-line p-8 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-2xl font-semibold mb-6">{cur ? "Editar contato" : "Novo contato"}</h3>
            <form action={cur ? updateContact.bind(null, cur.id) : createContact} className="space-y-4" onSubmit={() => setTimeout(() => setEditing(null), 50)}>
              <div><label className="label">Nome</label><input className="input" name="name" defaultValue={cur?.name ?? ""} required /></div>
              <div><label className="label">E-mail</label><input className="input" type="email" name="email" defaultValue={cur?.email ?? ""} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Telefone</label><input className="input font-mono" name="phone" defaultValue={cur?.phone ?? ""} /></div>
                <div><label className="label">Cargo</label><input className="input" name="role" defaultValue={cur?.role ?? ""} /></div>
              </div>
              <div><label className="label">Organização</label>
                <select className="input" name="org_id" defaultValue={cur?.org_id ?? ""}>
                  <option value="">— nenhuma (lead) —</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select></div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="opt_in_whatsapp" defaultChecked={cur?.opt_in_whatsapp ?? false} className="accent-[#C89B3C]" /> Opt-in WhatsApp
              </label>
              <div className="flex gap-3 pt-2">
                <button className="btn-gold">Salvar</button>
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            </form>
            {cur && (
              <form action={deleteContact.bind(null, cur.id)} className="mt-6 pt-6 border-t border-line" onSubmit={() => setTimeout(() => setEditing(null), 50)}>
                <button className="btn-ghost text-xs !text-muted2 hover:!text-cream">Excluir contato (auditado)</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
