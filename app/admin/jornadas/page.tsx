/** Jornadas (U2) — painel Kanban das transformações em paralelo. Card = 1 cliente, com a próxima ação. */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { ContentArea, PageHeader, Card, Badge, EmptyState, botaoClasses } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { listJourneys, JOURNEY_STAGES, getJourneySlaHoras } from "@/lib/journey";
import { avancarJornadaAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 5 colunas: Sprint (5) + Recorrência (6) agrupadas para o board não ficar largo demais.
const COLS: { titulo: string; etapas: number[] }[] = [
  { titulo: "Captar", etapas: [1] },
  { titulo: "Diagnóstico", etapas: [2] },
  { titulo: "Construção", etapas: [3] },
  { titulo: "Go-live", etapas: [4] },
  { titulo: "Sprint & Recorrência", etapas: [5, 6] },
];
const iniciais = (s: string | null) => (s ?? "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "—";

export default async function Jornadas({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const sp = await searchParams;
  const filtro = sp.filtro === "minhas" ? "minhas" : "todas";
  const [rows, sla, m] = await Promise.all([listJourneys(filtro), getJourneySlaHoras(), currentMembership()]);

  // nomes dos donos (para o avatar)
  const sb = await createClient();
  const { data: membros } = await sb.from("memberships").select("user_id, email").eq("role", "salestrack_admin");
  const nomeDono = new Map((membros ?? []).map((x) => [x.user_id, x.email as string]));

  const atrasadas = rows.filter((r) => r.atrasada).length;
  const filtroHref = (f: string) => `/admin/jornadas?filtro=${f}`;
  const chip = (active: boolean) => `rounded-ds-pill border px-3 py-1 font-montserrat text-[13px] transition-colors ${active ? "border-[color:var(--brand)] bg-[var(--tile)] text-[color:var(--brand-deep)]" : "border-hairline text-[color:var(--fg-3)] hover:border-[color:var(--brand-light)]"}`;

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Jornadas" }]} className="mb-4" />
      <PageHeader eyebrow="Operação" title="Jornadas de Transformação"
        subtitle="Todas as transformações em paralelo, por etapa. Cada card mostra a única próxima ação — clique para avançar ou abrir o cliente."
        actions={<Link href="/admin/jornadas/nova" className={botaoClasses()}><Icon name="rocket" size={15} /> Nova jornada</Link>} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Link href={filtroHref("todas")} className={chip(filtro === "todas")}>Todas</Link>
          <Link href={filtroHref("minhas")} className={chip(filtro === "minhas")}>Minhas</Link>
        </div>
        <p className="ds-small">{rows.length} jornada(s){atrasadas ? ` · ${atrasadas} atrasada(s) (SLA ${sla}h)` : ""}</p>
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={<Icon name="rocket" size={22} />} title="Nenhuma jornada ainda"
          description="Crie a primeira em uma tela — cria o cliente e já devolve o link do diagnóstico."
          action={<Link href="/admin/jornadas/nova" className={botaoClasses()}><Icon name="rocket" size={15} /> Nova jornada</Link>} /></Card>
      ) : (
        /**
         * Kanban é FLEX com rolagem, não grid.
         *
         * Era `grid lg:grid-cols-5` com `min-w-[240px]` nas células: cinco colunas de 240px não
         * cabem numa tela de 1280 com a barra lateral de 260px, e grid não rola — ele estoura, e a
         * última coluna ("Sprint & Recorrência") ficava cortada pela borda.
         *
         * Com flex + `shrink-0` + `overflow-x-auto`, a régua rola como Kanban de verdade e nenhuma
         * coluna é espremida até o título quebrar.
         */
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {COLS.map((col) => {
            const cards = rows.filter((r) => col.etapas.includes(r.etapaAtual));
            return (
              <div key={col.titulo} className="w-[268px] shrink-0 rounded-ds-card border border-hairline bg-[var(--bg-2)] p-2.5">
                <div className="flex items-center justify-between gap-2 px-1.5 pb-2.5">
                  <span className="truncate font-montserrat text-[13px] font-semibold text-[color:var(--fg-2)]">{col.titulo}</span>
                  <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-[var(--gray-100)] px-1.5 font-jbmono text-[11px] text-[color:var(--fg-3)]">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {cards.map((r) => (
                    <div key={r.projectId} className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-3">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <Link href={`/admin/clientes/${r.orgId}`} className="min-w-0 font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)] hover:text-[color:var(--brand)]">
                          <span className="block leading-snug">{r.orgName}</span>
                        </Link>
                        {r.owner && <span title={nomeDono.get(r.owner) ?? "responsável"} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{iniciais(nomeDono.get(r.owner) ?? null)}</span>}
                      </div>
                      {r.contatoNome && <p className="mb-1.5 truncate font-montserrat text-[11.5px] text-[color:var(--fg-3)]">{r.contatoNome}</p>}
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone="brand">{r.etapaTitulo}</Badge>
                        {r.atrasada && <Badge tone="warn">atrasada</Badge>}
                        <span className="font-jbmono text-[11px] text-[color:var(--fg-4)]">{r.progresso}%</span>
                      </div>
                      <p className="mb-2.5 font-montserrat text-[13px] leading-snug text-[color:var(--fg-2)]"><span className="text-[color:var(--fg-4)]">Próximo:</span> {r.proximaAcao}</p>
                      {/*
                        Empilhados e de largura cheia. Lado a lado numa coluna de 268px, o rótulo
                        "Concluir etapa →" quebrava em duas linhas e encostava no botão vizinho.
                      */}
                      <div className="flex flex-col gap-1.5">
                        <form action={avancarJornadaAction.bind(null, r.projectId)}>
                          <button className={botaoClasses({ size: "sm", className: "w-full justify-center" })}>
                            Concluir etapa →
                          </button>
                        </form>
                        <Link href={`/admin/clientes/${r.orgId}`}
                          className="ds-focus block rounded-ds-input border border-hairline-strong px-2.5 py-1.5 text-center font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">
                          Abrir cliente
                        </Link>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <p className="px-1.5 py-3 font-montserrat text-[13px] text-[color:var(--fg-4)]">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ContentArea>
  );
}
