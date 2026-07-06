import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmNav } from "@/components/crm/CrmNav";
import { AiAssist } from "@/components/AiAssist";
import { ORG_PLAN_LABELS, ORG_STATUS_LABELS, STAGE_LABELS, brl, type Organization, type Deal, type Contact } from "@/lib/types";
import { updateOrg, deleteOrg, addContactToOrg } from "../actions";

export const dynamic = "force-dynamic";

export default async function ContaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("*").eq("id", id).single();
  if (!org) notFound();
  const [{ data: deals }, { data: contacts }] = await Promise.all([
    supabase.from("deals").select("*").eq("org_id", id).order("created_at", { ascending: false }),
    supabase.from("contacts").select("*").eq("org_id", id).order("name"),
  ]);
  const o = org as Organization;
  const dealList = (deals as Deal[] | null) ?? [];
  const contactList = (contacts as Contact[] | null) ?? [];
  const accCtx = [
    `Conta: ${o.name}${o.cnpj ? ` · CNPJ ${o.cnpj}` : ""} · plano ${o.plan} · status ${o.status}${o.icp ? ` · ICP ${o.icp}` : ""}`,
    dealList.length ? `Deals:\n${dealList.map((d) => `- ${d.title} · ${STAGE_LABELS[d.stage] ?? d.stage} · ${brl(d.value_estimated)}`).join("\n")}` : "Sem deals.",
    contactList.length ? `Contatos: ${contactList.map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ")}` : "Sem contatos.",
  ].join("\n");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6"><Link href="/admin/crm/contas" className="text-muted2 hover:text-gold text-sm">← Contas</Link></div>
      <CrmNav />
      <div className="mb-5">
        <AiAssist context={accCtx} title="Copiloto da conta" actions={[
          { label: "Resumo 360º da conta", task: "Faça um resumo executivo desta conta: momento, oportunidades abertas, riscos e a próxima melhor ação. Bullets." },
          { label: "Plano de relacionamento", task: "Sugira um plano de relacionamento/expansão para esta conta nos próximos 30-60 dias, prático." },
          { label: "Rascunhar e-mail ao contato", task: "Rascunhe um e-mail de relacionamento para o principal contato desta conta, no tom André Kachan, com um próximo passo claro." },
        ]} />
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <form action={updateOrg.bind(null, id)} className="space-y-4">
              <input className="input !text-2xl font-serif !py-2" name="name" defaultValue={o.name} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="label">CNPJ</label><input className="input font-mono" name="cnpj" defaultValue={o.cnpj ?? ""} /></div>
                <div><label className="label">Plano</label>
                  <select className="input" name="plan" defaultValue={o.plan}>{Object.entries(ORG_PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">Status</label>
                  <select className="input" name="status" defaultValue={o.status}>{Object.entries(ORG_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">ICP</label>
                  <select className="input" name="icp" defaultValue={o.icp ?? ""}><option value="">—</option><option>1</option><option>2</option><option>3</option></select></div>
              </div>
              <button className="btn-gold">Salvar</button>
            </form>
          </div>

          <div className="card p-6">
            <h2 className="font-serif text-xl font-semibold mb-4">Deals ({(deals ?? []).length})</h2>
            <div className="space-y-2">
              {(deals as Deal[] | null)?.map((d) => (
                <Link key={d.id} href={`/admin/crm/${d.id}`} className="flex justify-between items-center bg-navy3 border border-line rounded-lg px-3 py-2 hover:border-goldline">
                  <span className="text-sm text-cream">{d.title}</span>
                  <span className="text-xs text-muted2">{STAGE_LABELS[d.stage]} · {brl(d.value_estimated)}</span>
                </Link>
              ))}
              {(!deals || deals.length === 0) && <p className="text-sm text-muted2">Sem deals nesta conta.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="font-serif text-xl font-semibold mb-3">Contatos ({(contacts ?? []).length})</h3>
            <div className="space-y-2 mb-4">
              {(contacts as Contact[] | null)?.map((c) => (
                <div key={c.id} className="text-sm flex items-center justify-between gap-2">
                  <div><p className="text-cream">{c.name}{c.role && <span className="text-muted2 text-xs"> · {c.role}</span>}</p>{c.email && <p className="text-[11px] text-muted2">{c.email}</p>}</div>
                  {c.opt_in_whatsapp && <span className="badge-teal shrink-0">wpp</span>}
                </div>
              ))}
              {(!contacts || contacts.length === 0) && <p className="text-sm text-muted2">Sem contatos ainda.</p>}
            </div>
            <details className="border-t border-line pt-3">
              <summary className="cursor-pointer text-sm text-gold">+ Adicionar contato à conta</summary>
              <form action={addContactToOrg.bind(null, id)} className="mt-3 space-y-2">
                <input className="input" name="name" placeholder="Nome" required />
                <input className="input" name="email" type="email" placeholder="E-mail" />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input font-mono" name="phone" placeholder="Telefone" />
                  <input className="input" name="role" placeholder="Cargo" />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="opt_in_whatsapp" className="accent-[#4F1FFF]" /> Opt-in WhatsApp</label>
                <button className="btn-gold w-full justify-center">Adicionar contato</button>
              </form>
            </details>
          </div>
          <form action={deleteOrg.bind(null, id)} className="card p-6">
            <button className="btn-ghost w-full justify-center text-xs !text-muted2 hover:!text-cream">Excluir conta (auditado)</button>
          </form>
        </div>
      </div>
    </div>
  );
}
