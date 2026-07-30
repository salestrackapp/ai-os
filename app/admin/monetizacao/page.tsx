import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasBilling } from "@/lib/billing/stripe";
import { brl } from "@/lib/types";
import { ConfigLink } from "@/components/config/ConfigLink";
import { savePlan, assignPlan, saveBranding, toggleGovernance } from "./actions";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

type Plan = { id: string; key: string; name: string; price_monthly: number; stripe_price_id: string | null; features: Record<string, unknown>; ordem: number };
const BOOL_FEATS = ["playbook", "consultor", "sessoes", "roi", "whitelabel_n2", "whitelabel_n3", "governanca_avancada"];
const LEVELS = [["n1_padrao", "N1 · Padrão"], ["n2_personalizado", "N2 · Tema próprio"], ["n3_whitelabel", "N3 · Domínio próprio"]];

export default async function MonetizacaoPage() {
  const supabase = await createClient();
  const [{ data: plans }, { data: orgs }, { data: subs }, { data: brandings }, { data: govs }] = await Promise.all([
    supabase.from("plans").select("*").order("ordem"),
    supabase.from("organizations").select("id, name").eq("is_salestrack", false).order("name"),
    supabase.from("subscriptions").select("org_id, plan_key, status, monthly_platform_fee, updated_at").order("updated_at", { ascending: false }),
    supabase.from("tenant_branding").select("*"),
    supabase.from("governance_policies").select("org_id, published"),
  ]);
  const planList = (plans as Plan[]) ?? [];
  const orgList = (orgs as { id: string; name: string }[]) ?? [];
  const subByOrg: Record<string, { plan_key: string; status: string; monthly_platform_fee: number }> = {};
  for (const s of subs ?? []) if (!subByOrg[s.org_id]) subByOrg[s.org_id] = s as never;
  const brandByOrg: Record<string, Record<string, string | null>> = Object.fromEntries((brandings ?? []).map((b) => [b.org_id, b]));
  const govByOrg: Record<string, boolean> = Object.fromEntries((govs ?? []).map((g) => [g.org_id, g.published]));
  const mrr = Object.values(subByOrg).filter((s) => s.status === "ativa").reduce((a, s) => a + (s.monthly_platform_fee ?? 0), 0);
  const porPlano = planList.map((p) => ({ key: p.key, name: p.name, n: Object.values(subByOrg).filter((s) => s.plan_key === p.key && s.status === "ativa").length }));

  return (
    <ContentArea>
      <div>
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap"><div><p className="text-[13px] uppercase tracking-[.24em] text-muted2 mb-1">Monetizar</p><h1 className="font-serif text-4xl font-semibold">Central de Monetização</h1>
          <p className="text-sm text-muted mt-1">{hasBilling() ? "Stripe conectado." : "Stripe em modo manual (sem chave) — assinaturas e faturas geridas à mão."}</p></div>
          <ConfigLink cat="planos" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="card p-6"><p className="label">MRR (plataforma)</p><p className="font-serif text-3xl font-semibold text-gold mt-1">{brl(mrr)}</p><p className="text-xs text-muted mt-2">assinaturas ativas</p></div>
          {porPlano.map((p) => <div key={p.key} className="card p-6"><p className="label">{p.name}</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{p.n}</p><p className="text-xs text-muted mt-2">clientes ativos</p></div>)}
        </div>

        {/* Planos */}
        <section className="mb-10">
          <h2 className="font-serif text-2xl font-semibold mb-4">Planos</h2>
          <div className="grid lg:grid-cols-3 gap-4">
            {planList.map((p) => (
              <form key={p.id} action={savePlan.bind(null, p.id)} className="card p-5 space-y-2">
                <div className="flex items-center justify-between"><input name="name" defaultValue={p.name} className="input text-sm font-serif !text-lg w-40" /><span className="badge-muted">{p.key}</span></div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="label">Preço/mês</label><input name="price_monthly" type="number" step="0.01" defaultValue={p.price_monthly} className="input text-sm" /></div>
                  <div className="flex-1"><label className="label">Stripe price id</label><input name="stripe_price_id" defaultValue={p.stripe_price_id ?? ""} className="input text-sm" placeholder="price_..." /></div>
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {BOOL_FEATS.map((f) => <label key={f} className="flex items-center gap-1.5 text-[13px] text-muted"><input type="checkbox" name={`f_${f}`} defaultChecked={!!p.features?.[f]} /> {f}</label>)}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="label">Membros</label><input name="f_limite_membros" type="number" defaultValue={Number(p.features?.limite_membros ?? 5)} className="input text-sm" /></div>
                  <div className="flex-1"><label className="label">Créd. sessão/mês</label><input name="f_creditos_sessao_mes" type="number" defaultValue={Number(p.features?.creditos_sessao_mes ?? 0)} className="input text-sm" /></div>
                </div>
                <button className="btn-ghost text-xs">Salvar plano</button>
              </form>
            ))}
          </div>
        </section>

        {/* Orgs: plano + white-label + governança */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-4">Clientes</h2>
          <div className="space-y-4">
            {orgList.map((o) => {
              const s = subByOrg[o.id]; const b = brandByOrg[o.id] ?? {};
              return (
                <div key={o.id} className="card p-6">
                  <h3 className="font-serif text-lg font-semibold mb-3">{o.name}</h3>
                  <div className="grid lg:grid-cols-3 gap-4">
                    {/* plano */}
                    <form action={assignPlan.bind(null, o.id)} className="space-y-2">
                      <p className="label">Plano & mensalidade</p>
                      <select name="plan_key" defaultValue={s?.plan_key ?? "base"} className="input text-sm w-full">{planList.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
                      <div className="flex gap-2">
                        <input name="monthly_platform_fee" type="number" step="0.01" defaultValue={s?.monthly_platform_fee ?? 0} className="input text-sm" placeholder="R$/mês" />
                        <select name="status" defaultValue={s?.status ?? "ativa"} className="input text-sm">{["ativa", "trial", "atrasada", "cancelada"].map((x) => <option key={x}>{x}</option>)}</select>
                      </div>
                      <button className="btn-gold text-xs">Aplicar plano</button>
                    </form>
                    {/* white-label */}
                    <form action={saveBranding.bind(null, o.id)} className="space-y-2">
                      <p className="label">White-label</p>
                      <div className="flex gap-2">
                        <select name="level" defaultValue={(b.level as string) ?? "n1_padrao"} className="input text-sm flex-1">{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        <input name="color_accent" defaultValue={(b.color_accent as string) ?? ""} className="input text-sm w-24" placeholder="#accent" />
                      </div>
                      <div className="flex gap-2">
                        <input name="internal_name" defaultValue={(b.internal_name as string) ?? ""} className="input text-sm flex-1" placeholder="Nome exibido" />
                        <input name="color_primary" defaultValue={(b.color_primary as string) ?? ""} className="input text-sm w-24" placeholder="#primary" />
                      </div>
                      <input name="logo_url" defaultValue={(b.logo_url as string) ?? ""} className="input text-sm" placeholder="Logo URL" />
                      <input name="custom_domain" defaultValue={(b.custom_domain as string) ?? ""} className="input text-sm" placeholder="Domínio próprio (N3)" />
                      <button className="btn-ghost text-xs">Salvar tema</button>
                    </form>
                    {/* governança */}
                    <div className="space-y-2">
                      <p className="label">Governança / Segurança</p>
                      <p className="text-xs text-muted2">{govByOrg[o.id] ? "Página pública publicada." : "Não publicada."}</p>
                      <form action={toggleGovernance.bind(null, o.id, !govByOrg[o.id])}><button className="btn-ghost text-xs">{govByOrg[o.id] ? "Despublicar" : "Publicar página de Segurança"}</button></form>
                      <Link href={`/admin/programas`} className="text-[13px] text-muted2 hover:text-gold block">O cliente edita a política no portal → Governança</Link>
                    </div>
                  </div>
                </div>
              );
            })}
            {orgList.length === 0 && <div className="card p-8"><p className="text-sm text-muted2">Nenhum cliente ainda.</p></div>}
          </div>
        </section>
      </div>
    </ContentArea>
  );
}
