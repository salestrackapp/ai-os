import { createClient } from "@/lib/supabase/server";
import { anthropicConfigured } from "@/lib/agents/runner";
import { asaasConfigured } from "@/lib/asaas";
import { googleConfigured } from "@/lib/google";
import { apolloConfigured } from "@/lib/apollo";
import { slackConfigured } from "@/lib/slack";
import { usdBrlLive } from "@/lib/finops/cost";
import { brl } from "@/lib/types";
import { ConfigLink } from "@/components/config/ConfigLink";
import { runOpsNow, ackAlert, resolveAlert, saveModelPrice } from "./actions";
import { PageHeader, ContentArea } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";

export const dynamic = "force-dynamic";

const RISK_BADGE: Record<string, string> = { baixo: "badge-teal", medio: "badge-gold", alto: "badge inline-flex text-[11px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10" };
const usd = (v: number) => `US$ ${v.toFixed(2)}`;

export default async function OperacoesPage() {
  const supabase = await createClient();
  const rate = await usdBrlLive();
  const today = new Date().toISOString().slice(0, 10);
  const from30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [{ data: orgs }, { data: health }, { data: costRows }, { data: alerts }, { data: prices }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("is_salestrack", false),
    supabase.from("tenant_health").select("*").eq("date", today),
    supabase.from("ai_cost_daily").select("org_id, agent_key, model, cost_usd, tokens_in, tokens_out").gte("date", from30),
    supabase.from("alerts").select("*").neq("status", "resolvido").order("created_at", { ascending: false }),
    supabase.from("model_prices").select("*").order("model"),
  ]);
  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  const healthByOrg: Record<string, { engagement_score: number; mrr: number; ai_cost_usd: number; margin_usd: number; churn_risk: string }> = Object.fromEntries((health ?? []).map((h) => [h.org_id, h as never]));
  // custo por org / por agente / por modelo (30d)
  const costByOrg: Record<string, number> = {}, costByAgent: Record<string, number> = {}, costByModel: Record<string, number> = {};
  let totalCost = 0;
  for (const c of costRows ?? []) {
    const v = Number(c.cost_usd ?? 0); totalCost += v;
    if (c.org_id) costByOrg[c.org_id] = (costByOrg[c.org_id] ?? 0) + v;
    costByAgent[c.agent_key ?? "?"] = (costByAgent[c.agent_key ?? "?"] ?? 0) + v;
    costByModel[c.model ?? "?"] = (costByModel[c.model ?? "?"] ?? 0) + v;
  }
  const totalMrr = (health ?? []).reduce((a, h) => a + Number(h.mrr ?? 0), 0);
  const mrrUsd = rate ? totalMrr / rate : totalMrr;
  const margin = mrrUsd - totalCost;
  const hasPrices = (prices ?? []).length > 0;

  const integrations = [
    { k: "Anthropic (agentes)", on: anthropicConfigured() }, { k: "ASAAS (cobrança)", on: (await asaasConfigured()) },
    { k: "Google (Gmail/Calendar)", on: (await googleConfigured()) }, { k: "Apollo (prospecção)", on: (await apolloConfigured()) },
    { k: "Slack (alertas)", on: slackConfigured() }, { k: "Cron (jobs)", on: !!process.env.CRON_SECRET },
    { k: "Preços de modelo (FinOps)", on: hasPrices }, { k: "Cotação USD/BRL", on: !!rate },
  ];

  return (
    <ContentArea>
      <div>
        <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Plataforma", href: "/admin/plataforma" }, { label: "Operações" }]} className="mb-4" />
        <PageHeader eyebrow="Plataforma · operações" title="Centro de operações"
          subtitle={`FinOps de IA, margem por cliente, saúde e alertas. ${rate ? `Câmbio USD/BRL ${rate}.` : "Custo em USD (defina USD_BRL para ver em BRL)."}`}
          comoUsar={<HelpButton routeKey="/admin/plataforma" />}
          actions={<div className="flex items-center gap-2"><ConfigLink cat="finops" /><form action={runOpsNow}><button className="btn-gold text-sm">Rodar jobs agora</button></form></div>} />

        {/* Consolidado MRR × Custo × Margem */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="card p-6"><p className="label">MRR (plataforma)</p><p className="font-serif text-3xl font-semibold text-gold mt-1">{brl(totalMrr)}</p></div>
          <div className="card p-6"><p className="label">Custo de IA (30d)</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{hasPrices ? usd(totalCost) : "n/config"}</p></div>
          <div className="card p-6"><p className="label">Margem (30d)</p><p className={`font-serif text-3xl font-semibold mt-1 ${margin >= 0 ? "text-teal-300" : "text-red-400"}`}>{hasPrices ? usd(margin) : "—"}</p><p className="text-xs text-muted mt-1">MRR(USD) − custo IA</p></div>
          <div className="card p-6"><p className="label">Alertas abertos</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{(alerts ?? []).length}</p></div>
        </div>

        {/* Integrações & Jobs */}
        <div className="card p-6 mb-8">
          <p className="label mb-3">Integrações & Jobs</p>
          <div className="flex flex-wrap gap-2">
            {integrations.map((i) => <span key={i.k} className={i.on ? "badge-teal" : "badge-muted"}>{i.on ? "● " : "○ "}{i.k}</span>)}
          </div>
        </div>

        {/* Margem por tenant */}
        <section className="mb-8">
          <h2 className="font-serif text-2xl font-semibold mb-3">Margem por cliente</h2>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Cliente</th><th className="th">Engajamento</th><th className="th">MRR</th><th className="th">Custo IA (30d)</th><th className="th">Margem</th><th className="th">Churn</th></tr></thead>
              <tbody>
                {(orgs ?? []).map((o) => {
                  const h = healthByOrg[o.id]; const c = costByOrg[o.id] ?? 0;
                  const mUsd = rate ? Number(h?.mrr ?? 0) / rate : Number(h?.mrr ?? 0);
                  const mg = mUsd - c;
                  return (
                    <tr key={o.id} className="hover:bg-navy3/50 border-b border-line last:border-0">
                      <td className="td text-cream">{o.name}</td>
                      <td className="td">{h ? <span className="badge-muted">{h.engagement_score}/100</span> : <span className="text-muted2 text-xs">—</span>}</td>
                      <td className="td text-muted">{brl(Number(h?.mrr ?? 0))}</td>
                      <td className="td text-muted">{hasPrices ? usd(c) : "n/config"}</td>
                      <td className="td"><span className={mg >= 0 ? "text-teal-300" : "text-red-400"}>{hasPrices && h ? usd(mg) : "—"}</span></td>
                      <td className="td">{h ? <span className={RISK_BADGE[h.churn_risk] ?? "badge-muted"}>{h.churn_risk}</span> : <span className="text-muted2 text-xs">rode os jobs</span>}</td>
                    </tr>
                  );
                })}
                {(orgs ?? []).length === 0 && <tr><td className="td text-muted2" colSpan={6}>Nenhum cliente.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* FinOps: por agente / modelo */}
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          <div className="card p-6"><p className="label mb-3">Custo por agente (30d)</p>
            {Object.entries(costByAgent).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="flex justify-between text-sm py-1"><span className="text-muted">{k}</span><span className="font-mono text-cream">{usd(v)}</span></div>)}
            {Object.keys(costByAgent).length === 0 && <p className="text-sm text-muted2">Sem custo apurado ainda — rode os jobs.</p>}
          </div>
          <div className="card p-6"><p className="label mb-3">Preços de modelo (USD/1M tokens)</p>
            {(prices ?? []).map((p) => (
              <form key={p.id} action={saveModelPrice.bind(null, p.id)} className="flex items-center gap-2 py-1">
                <span className="text-xs text-muted flex-1 truncate">{p.model}</span>
                <input name="price_in" type="number" step="0.01" defaultValue={p.price_in_per_mtok} className="input text-xs w-20" title="entrada" />
                <input name="price_out" type="number" step="0.01" defaultValue={p.price_out_per_mtok} className="input text-xs w-20" title="saída" />
                <button className="btn-ghost text-[13px]">ok</button>
              </form>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-3">Alertas</h2>
          <div className="space-y-2">
            {(alerts ?? []).map((a) => (
              <div key={a.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={a.severity === "critico" ? "badge inline-flex text-[11px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10" : "badge-gold"}>{a.severity}</span>
                  <span className="text-sm text-cream">{a.message}</span>
                  <span className="text-[13px] text-muted2">{a.kind} · {a.status}</span>
                </div>
                <div className="flex gap-2">
                  {a.status === "aberto" && <form action={ackAlert.bind(null, a.id)}><button className="btn-ghost text-xs">Reconhecer</button></form>}
                  <form action={resolveAlert.bind(null, a.id)}><button className="btn-ghost text-xs">Resolver</button></form>
                </div>
              </div>
            ))}
            {(alerts ?? []).length === 0 && <div className="card p-6"><p className="text-sm text-muted2">Nenhum alerta aberto.</p></div>}
          </div>
        </section>
      </div>
    </ContentArea>
  );
}
