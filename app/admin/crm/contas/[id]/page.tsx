import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmNav } from "@/components/crm/CrmNav";
import { ORG_PLAN_LABELS, ORG_STATUS_LABELS, STAGE_LABELS, brl, type Organization, type Deal, type Contact } from "@/lib/types";
import { updateOrg, deleteOrg } from "../actions";

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

  return (
    <div>
      <div className="flex items-center gap-3 mb-6"><Link href="/admin/crm/contas" className="text-muted2 hover:text-gold text-sm">← Contas</Link></div>
      <CrmNav />
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
            <div className="space-y-2">
              {(contacts as Contact[] | null)?.map((c) => (
                <div key={c.id} className="text-sm"><p className="text-cream">{c.name}</p>{c.email && <p className="text-[11px] text-muted2">{c.email}</p>}</div>
              ))}
              {(!contacts || contacts.length === 0) && <p className="text-sm text-muted2">Sem contatos. Cadastre em Contatos.</p>}
            </div>
          </div>
          <form action={deleteOrg.bind(null, id)} className="card p-6">
            <button className="btn-ghost w-full justify-center text-xs !text-muted2 hover:!text-cream">Excluir conta (auditado)</button>
          </form>
        </div>
      </div>
    </div>
  );
}
