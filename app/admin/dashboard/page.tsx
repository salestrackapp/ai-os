import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { emailMap } from "@/lib/supabase/admin";
import { DashboardCharts } from "@/components/DashboardCharts";
import { AiAssist } from "@/components/AiAssist";
import { ContentArea } from "@/components/ds";
import {
  DEAL_STAGES, STAGE_LABELS, STAGE_PROB, BRAND_LABELS, brl, daysSince, dealBrandValues, STAGNATION_DAYS, type Deal,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const CLOSED = ["cliente", "perdido"];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const { brand } = await searchParams;
  const supabase = await createClient();

  const [{ data: allDeals }, { count: reviewCount }, { data: acts }, { data: logs }, { data: openTasks }] = await Promise.all([
    supabase.from("deals").select("*").is("deleted_at", null),
    supabase.from("catalog_items").select("*", { count: "exact", head: true }).eq("needs_review", true),
    supabase.from("activities").select("id, kind, payload, created_at, ref_table, ref_id, actor_id").order("created_at", { ascending: false }).limit(15),
    supabase.from("audit_logs").select("id, action, resource, resource_id, created_at, actor_id").order("created_at", { ascending: false }).limit(15),
    supabase.from("tasks").select("id, title, due_date, deal_id").eq("done", false).not("due_date", "is", null).order("due_date"),
  ]);

  // Métricas do Método (Fase 4b/5) — globais, não filtradas por marca
  const week7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ count: recipesPub }, { count: conclusoes }, { data: creditRows }, { count: sessoesRealizadas }, { count: convWeek }, { count: roiPending }] = await Promise.all([
    supabase.from("playbook_recipes").select("*", { count: "exact", head: true }).eq("published", true),
    supabase.from("recipe_progress").select("*", { count: "exact", head: true }).eq("status", "concluida"),
    supabase.from("session_credits").select("total, consumed"),
    supabase.from("sessions").select("*", { count: "exact", head: true }).eq("status", "realizada"),
    supabase.from("conversations").select("*", { count: "exact", head: true }).gte("created_at", week7),
    supabase.from("roi_reports").select("*", { count: "exact", head: true }).eq("publicado", false),
  ]);
  const saldoSessoes = ((creditRows as { total: number; consumed: number }[]) ?? []).reduce((s, c) => s + Math.max(0, (c.total ?? 0) - (c.consumed ?? 0)), 0);

  const deals = ((allDeals as Deal[]) ?? []).filter((d) => !brand || d.brand === brand);
  const active = deals.filter((d) => !CLOSED.includes(d.stage));

  const pipelineTotal = active.reduce((a, d) => a + (d.value_estimated ?? 0), 0);
  const weighted = active.reduce((a, d) => a + (d.value_estimated ?? 0) * (STAGE_PROB[d.stage] ?? 0), 0);

  const cards = [
    { label: "Pipeline total", value: brl(pipelineTotal), note: `${active.length} deals abertos` },
    { label: "Pipeline ponderado", value: brl(weighted), note: "valor × probabilidade por estágio" },
    { label: "Deals ativos", value: String(active.length), note: "excluindo cliente e perdido" },
    { label: "Catálogo a revisar", value: String(reviewCount ?? 0), note: "itens com preço pendente" },
  ];

  // Charts
  const funnel = DEAL_STAGES.map((s) => {
    const ds = deals.filter((d) => d.stage === s);
    return { stage: STAGE_LABELS[s], qtd: ds.length, valor: ds.reduce((a, d) => a + (d.value_estimated ?? 0), 0) };
  });
  const DAY = 86_400_000;
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const end = Date.now() - (11 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const count = deals.filter((d) => { const t = new Date(d.created_at).getTime(); return t > start && t <= end; }).length;
    return { week: new Date(end).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), count };
  });
  const byIcp = [1, 2, 3, 0].map((n) => ({
    icp: n === 0 ? "s/ICP" : `ICP ${n}`,
    valor: deals.filter((d) => (d.icp ?? 0) === n).reduce((a, d) => a + (d.value_estimated ?? 0), 0),
  }));
  // Multi-marca: análise SEPARADA (por alocação de marca) e INTEGRADA (total)
  const brandTotals: Record<string, number> = {};
  for (const d of active) for (const a of dealBrandValues(d)) brandTotals[a.brand] = (brandTotals[a.brand] ?? 0) + (a.value || 0);
  const integrated = Object.values(brandTotals).reduce((s, v) => s + v, 0);
  const brandRows = ["andre_kachan", "salestrack", "ai_os"]
    .map((b) => ({ brand: b, label: BRAND_LABELS[b], valor: brandTotals[b] ?? 0 }))
    .filter((r) => r.valor > 0);
  const split = [
    { name: "André Kachan", valor: brandTotals["andre_kachan"] ?? 0, qtd: deals.filter((d) => dealBrandValues(d).some((a) => a.brand === "andre_kachan")).length },
    { name: "Salestrack", valor: brandTotals["salestrack"] ?? 0, qtd: deals.filter((d) => dealBrandValues(d).some((a) => a.brand === "salestrack")).length },
  ];

  // Tarefas com prazo
  const dealTitleAll: Record<string, string> = Object.fromEntries(((allDeals as Deal[]) ?? []).map((d) => [d.id, d.title]));
  const todayStr = new Date().toISOString().slice(0, 10);
  const in14Str = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const taskHref = (t: { deal_id: string | null }) => t.deal_id ? `/admin/crm/${t.deal_id}` : "/admin/tarefas";
  const taskLabel = (t: { title: string; deal_id: string | null }) => `${t.title}${t.deal_id ? ` — ${dealTitleAll[t.deal_id] ?? "deal"}` : ""}`;
  const tasksDue = (openTasks ?? []).filter((t) => t.due_date && t.due_date <= todayStr);
  const tasksUpcoming = (openTasks ?? []).filter((t) => t.due_date && t.due_date > todayStr && t.due_date <= in14Str);

  // Ações do Dia: tarefas vencidas/hoje primeiro, depois heurísticas
  type Acao = { text: string; href: string; tag: string };
  const acoes: Acao[] = [];
  for (const t of tasksDue) acoes.push({ text: taskLabel(t), href: taskHref(t), tag: t.due_date! < todayStr ? "vencida" : "hoje" });
  for (const d of deals) {
    if (d.score >= 20 && (d.stage === "sinal" || d.stage === "qualificado")) { acoes.push({ text: `Abordar ${d.title}`, href: `/admin/crm/${d.id}`, tag: "sinal" }); break; }
  }
  for (const d of deals) {
    const days = daysSince(d.last_activity_at);
    if (days !== null && days >= STAGNATION_DAYS && ["diagnostico", "proposta", "fechamento"].includes(d.stage)) { acoes.push({ text: `Retomar ${d.title} — ${days} dias parado`, href: `/admin/crm/${d.id}`, tag: "estagnado" }); break; }
  }
  if ((reviewCount ?? 0) > 0) acoes.push({ text: `Revisar preços: ${reviewCount} itens pendentes`, href: "/admin/catalogo", tag: "catálogo" });

  // Próximas tarefas e ações (14 dias): tarefas futuras + fechamentos previstos
  type Prox = { text: string; href: string; date: string; tag: string };
  const proximas: Prox[] = [];
  for (const t of tasksUpcoming) proximas.push({ text: taskLabel(t), href: taskHref(t), date: t.due_date!, tag: "tarefa" });
  for (const d of deals) {
    if (d.expected_close && d.expected_close > todayStr && d.expected_close <= in14Str && !CLOSED.includes(d.stage))
      proximas.push({ text: `Fechamento previsto — ${d.title}`, href: `/admin/crm/${d.id}`, date: d.expected_close, tag: "deal" });
  }
  proximas.sort((a, b) => a.date.localeCompare(b.date));

  // Feed mesclado
  const RELEVANT = ["deal.create", "deal.lost", "deal.convert_client", "org.create", "catalog.update", "catalog.create", "contact.create"];
  type Feed = { id: string; when: string; text: string; href?: string; who: string | null; actor: string | null };
  const feedActs: Feed[] = (acts ?? []).map((a) => ({
    id: `a${a.id}`, when: a.created_at, actor: a.actor_id,
    who: null,
    text: a.kind === "nota" ? "Nota adicionada" : a.kind === "estagio" ? `Estágio → ${STAGE_LABELS[String((a.payload as Record<string, unknown>)?.to)] ?? ""}` : a.kind === "sistema" ? "Evento do sistema" : a.kind,
    href: a.ref_table === "deals" && a.ref_id ? `/admin/crm/${a.ref_id}` : undefined,
  }));
  const feedLogs: Feed[] = (logs ?? []).filter((l) => RELEVANT.includes(l.action)).map((l) => ({
    id: `l${l.id}`, when: l.created_at, actor: l.actor_id, who: null,
    text: l.action.replace(/\./g, " · "),
    href: l.resource === "catalog_items" && l.resource_id ? `/admin/catalogo/${l.resource_id}`
      : l.resource === "deals" && l.resource_id ? `/admin/crm/${l.resource_id}` : undefined,
  }));
  const emails = await emailMap([...feedActs, ...feedLogs].map((f) => f.actor));
  const feed = [...feedActs, ...feedLogs].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 15)
    .map((f) => ({ ...f, who: f.actor ? (emails[f.actor] ?? "sistema") : "sistema" }));

  const brands = [{ k: "", l: "Todas" }, { k: "andre_kachan", l: "André Kachan" }, { k: "salestrack", l: "Salestrack" }];

  const dashContext = [
    `Pipeline total: ${brl(pipelineTotal)} · ponderado: ${brl(weighted)} · ${active.length} deals ativos`,
    `Funil: ${funnel.map((f) => `${f.stage} ${f.qtd} (${brl(f.valor)})`).join(" | ")}`,
    brandRows.length ? `Por marca: ${brandRows.map((r) => `${r.label} ${brl(r.valor)}`).join(" · ")}` : "",
    tasksDue.length ? `Tarefas vencidas/hoje: ${tasksDue.length}` : "",
    acoes.length ? `Ações sugeridas: ${acoes.slice(0, 5).map((a) => a.text).join("; ")}` : "",
  ].filter(Boolean).join("\n");

  return (
    <ContentArea>
      <div>
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <p className="text-[13px] uppercase tracking-[.24em] text-muted2 mb-1">Fase 1.5 · Comando</p>
            <h1 className="font-serif text-4xl font-semibold">Dashboard Executivo</h1>
          </div>
          <div className="flex gap-2 items-center self-end">
            {brands.map((b) => (
              <Link key={b.k} href={b.k ? `/admin/dashboard?brand=${b.k}` : "/admin/dashboard"}
                className={`badge-muted ${(brand ?? "") === b.k ? "!text-gold !border-goldline" : ""}`}>{b.l}</Link>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          {cards.map((c) => (
            <div key={c.label} className="card p-6">
              <p className="label">{c.label}</p>
              <p className="font-serif text-3xl font-semibold text-gold mt-1">{c.value}</p>
              <p className="mt-2 text-xs text-muted">{c.note}</p>
            </div>
          ))}
        </div>

        {/* Copiloto executivo (IA) */}
        <div className="mb-5">
          <AiAssist context={dashContext} title="Copiloto executivo" actions={[
            { label: "Insights do dia", task: "A partir do pipeline abaixo, gere 3 insights executivos e 3 ações prioritárias para hoje. Bullets curtos e diretos." },
            { label: "Resumo para reunião", task: "Escreva um resumo executivo do momento comercial (pipeline, riscos, foco) em 1 parágrafo, pronto para uma reunião de liderança." },
            { label: "Onde estou perdendo dinheiro?", task: "Aponte os gargalos do funil e onde há mais valor parado ou em risco, com a ação recomendada para cada." },
          ]} />
        </div>

        {/* Método (Fase 4b): adoção do Playbook + entrega ao vivo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          <Link href="/admin/estudio" className="card p-6 hover:border-goldline transition-colors">
            <p className="label">Receitas publicadas</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{recipesPub ?? 0}</p><p className="mt-2 text-xs text-muted">Playbook · Estúdio do Método</p>
          </Link>
          <div className="card p-6"><p className="label">Receitas concluídas</p><p className="font-serif text-3xl font-semibold text-gold mt-1">{conclusoes ?? 0}</p><p className="mt-2 text-xs text-muted">adoção pelos clientes</p></div>
          <div className="card p-6"><p className="label">Sessões realizadas</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{sessoesRealizadas ?? 0}</p><p className="mt-2 text-xs text-muted">entrega ao vivo</p></div>
          <div className="card p-6"><p className="label">Saldo de sessões</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{saldoSessoes}</p><p className="mt-2 text-xs text-muted">créditos disponíveis (todos os clientes)</p></div>
        </div>

        {/* Consultor & Sucesso (Fase 5) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          <Link href="/admin/consultor" className="card p-6 hover:border-goldline transition-colors"><p className="label">Conversas (7 dias)</p><p className="font-serif text-3xl font-semibold text-gold mt-1">{convWeek ?? 0}</p><p className="mt-2 text-xs text-muted">Consultor do Programa</p></Link>
          <Link href="/admin/roi" className="card p-6 hover:border-goldline transition-colors"><p className="label">ROI a publicar</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{roiPending ?? 0}</p><p className="mt-2 text-xs text-muted">relatórios em rascunho</p></Link>
        </div>

        {/* Ações do Dia + Próximas */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <div className="card p-6 border-goldline bg-[rgba(0, 122, 148,.05)]">
            <p className="text-[13px] uppercase tracking-[.24em] text-gold mb-3">Ações do Dia</p>
            {acoes.length === 0 ? <p className="text-sm text-muted">Nada urgente — pipeline saudável.</p> : (
              <ul className="space-y-2">
                {acoes.map((a, i) => (
                  <li key={i}>
                    <Link href={a.href} className="flex items-center gap-2 text-sm text-cream hover:text-gold">
                      <span className={`shrink-0 ${a.tag === "vencida" ? "badge inline-flex text-[11px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10" : a.tag === "hoje" ? "badge-teal" : "badge-muted"}`}>{a.tag}</span>
                      <span className="flex-1">{a.text}</span><span className="text-muted2">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-6">
            <p className="text-[13px] uppercase tracking-[.24em] text-muted2 mb-3">Próximas tarefas e ações · 14 dias</p>
            {proximas.length === 0 ? <p className="text-sm text-muted2">Nada agendado para os próximos 14 dias.</p> : (
              <ul className="space-y-2">
                {proximas.slice(0, 8).map((p, i) => (
                  <li key={i}>
                    <Link href={p.href} className="flex items-center gap-2 text-sm text-muted hover:text-gold">
                      <span className="text-[13px] text-muted2 w-14 shrink-0 font-mono">{new Date(p.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                      <span className={`shrink-0 ${p.tag === "deal" ? "badge-gold" : "badge-muted"}`}>{p.tag}</span>
                      <span className="flex-1 text-cream">{p.text}</span>
                    </Link>
                  </li>
                ))}
                {proximas.length > 8 && <li className="text-xs text-muted2 pl-1">+{proximas.length - 8} mais…</li>}
              </ul>
            )}
          </div>
        </div>

        {/* Análise por marca: separada × integrada */}
        <div className="card p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="label">Pipeline por marca — separado × integrado</p>
            <p className="text-sm text-muted">Integrado (total): <span className="text-gold font-mono">{brl(integrated)}</span></p>
          </div>
          {brandRows.length === 0 ? <p className="text-sm text-muted2">Sem valores alocados no pipeline ativo.</p> : (
            <div className="space-y-2">
              {brandRows.map((r) => {
                const pct = integrated ? Math.round((r.valor / integrated) * 100) : 0;
                return (
                  <div key={r.brand} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-muted">{r.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-navy3 overflow-hidden">
                      <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-28 text-right font-mono text-sm text-cream">{brl(r.valor)}</span>
                    <span className="w-10 text-right text-xs text-muted2">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="mb-5"><DashboardCharts funnel={funnel} weekly={weekly} byIcp={byIcp} split={split} /></div>

        {/* Feed */}
        <div className="card p-6">
          <p className="label mb-4">Atividade recente</p>
          <ul className="space-y-3">
            {feed.map((f) => (
              <li key={f.id} className="flex items-baseline gap-3 text-sm">
                <span className="text-[13px] text-muted2 w-28 shrink-0">{new Date(f.when).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-muted2">{f.who}</span>
                {f.href ? <Link href={f.href} className="text-cream hover:text-gold">{f.text}</Link> : <span className="text-cream">{f.text}</span>}
              </li>
            ))}
            {feed.length === 0 && <li className="text-sm text-muted2">Sem atividades ainda.</li>}
          </ul>
        </div>
      </div>
    </ContentArea>
  );
}
