import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABELS, STATUS_LABELS, BRAND_LABELS, type DeliverableKind } from "@/lib/deliverables/types";
import { allLines, linesInFamily, FAMILIES } from "@/lib/studio/define-line";
import "@/lib/studio/lines"; // registra as linhas
import { ContentArea, PageHeader, Card, Badge, Table, Input, Select, Textarea, type Column } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { HelpButton } from "@/components/guidance/HelpButton";
import { createManualAction, generateLineAction, approveStudioAction, rejectStudioAction } from "./actions";

export const dynamic = "force-dynamic";

const ST_TONE: Record<string, "neutral" | "brand" | "warn" | "success"> = {
  rascunho: "neutral", gerando: "brand", em_revisao: "warn", aprovado: "brand", entregue: "success", publicado: "success",
};

const lbl = "mb-1.5 block font-montserrat text-[12px] font-medium text-[color:var(--fg-2)]";

type Row = { id: string; title: string; kind: string; status: string; format: string; org_id: string; version: number; brand: string; line: string | null };

export default async function EntregaveisPage() {
  const supabase = await createClient();
  const [{ data: list }, { data: pending }, { data: orgs }] = await Promise.all([
    supabase.from("studio_deliverables").select("id, title, kind, status, format, org_id, version, brand, line, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    supabase.from("studio_deliverables").select("id, title, kind, org_id, brand, line").eq("status", "em_revisao").is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("organizations").select("id, name").eq("is_salestrack", false).order("name"),
  ]);
  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  const soleOrg = (orgs ?? []).length === 1 ? (orgs![0].id as string) : ""; // default inteligente: 1 cliente = pré-selecionado
  const kinds = Object.keys(KIND_LABELS) as DeliverableKind[];
  const lines = allLines();
  const lineLabel: Record<string, string> = Object.fromEntries(lines.map((l) => [l.key, l.label]));
  const pend = pending ?? [];

  const columns: Column<Row>[] = [
    { key: "title", header: "Título", render: (d) => (
      <div className="min-w-0">
        <Link href={`/admin/entregaveis/${d.id}`} className="font-montserrat text-[13px] font-medium text-[color:var(--fg-1)] hover:text-[color:var(--brand)]">{d.title}</Link>
        {d.line && <span className="ml-2 text-[11px] text-[color:var(--fg-4)]">· {lineLabel[d.line] ?? d.line}</span>}
      </div>
    ) },
    { key: "kind", header: "Tipo", render: (d) => <span className="text-[color:var(--fg-3)]">{KIND_LABELS[d.kind as DeliverableKind] ?? d.kind}</span> },
    { key: "brand", header: "Marca", render: (d) => <Badge tone={d.brand === "salestrack" ? "brand" : "neutral"}>{BRAND_LABELS[d.brand] ?? d.brand}</Badge> },
    { key: "org", header: "Cliente", render: (d) => <span className="text-[color:var(--fg-3)]">{orgName[d.org_id] ?? "—"}</span> },
    { key: "status", header: "Status", render: (d) => <Badge tone={ST_TONE[d.status] ?? "neutral"}>{STATUS_LABELS[d.status] ?? d.status}</Badge> },
    { key: "version", header: "v", align: "right", mono: true, render: (d) => <>{d.version}</> },
    { key: "go", header: "", align: "right", render: (d) => <Link href={`/admin/entregaveis/${d.id}`} className="font-montserrat text-[12px] font-medium text-[color:var(--brand)] hover:underline">Abrir</Link> },
  ];

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Estúdio", href: "/admin/entregaveis" }, { label: "Entregáveis" }]} className="mb-4" />
      <PageHeader eyebrow="Estúdio · Produção" title="Estúdio de Entregáveis"
        subtitle="A IA rascunha · você aprova · o sistema publica — na identidade Salestrack AI."
        comoUsar={<HelpButton routeKey="/admin/entregaveis" />}
        actions={<div className="flex items-center gap-2">
          <Link href="/admin/entregaveis/identidade" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-semibold text-[color:var(--fg-1)] hover:bg-[var(--bg-2)]"><Icon name="gem" size={15} /> Identidade do programa</Link>
          <Link href="/admin/entregaveis/novo" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"><Icon name="fileText" size={15} /> Novo entregável</Link>
        </div>} />

      {/* Catálogo por família — tudo que dá para produzir */}
      <section className="mb-6">
        <p className="ds-eyebrow mb-3">Catálogo de produções</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FAMILIES.map((f) => {
            const fl = linesInFamily(f.key);
            return (
              <div key={f.key} className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4 shadow-ds-xs">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--tile)] text-[color:var(--brand)]"><Icon name={f.icon} size={15} /></span>
                  <p className="font-montserrat text-[13.5px] font-semibold text-[color:var(--fg-1)]">{f.label}</p>
                </div>
                <p className="ds-small !mt-0 mb-2">{f.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {fl.map((l) => <span key={l.key} className="rounded-ds-pill border border-hairline bg-[var(--bg-2)] px-2 py-0.5 font-montserrat text-[11px] text-[color:var(--fg-3)]">{l.label}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Fila de aprovação — o gate humano */}
      <Card bloom className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><Icon name="shield" size={17} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Aprovações pendentes</p></div>
          <Badge tone={pend.length ? "warn" : "neutral"}>{pend.length}</Badge>
        </div>
        {pend.length === 0 ? (
          <p className="ds-small">Nada em revisão. Gere um entregável com IA ao lado — ele cai aqui para sua aprovação antes de ir ao cliente.</p>
        ) : (
          <ul className="space-y-2">
            {pend.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-hairline bg-[var(--bg-2)] px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-montserrat text-[13px] text-[color:var(--fg-1)]">{d.title}</p>
                  <p className="ds-small !mt-0.5">{orgName[d.org_id] ?? "—"} · {BRAND_LABELS[d.brand] ?? d.brand}{d.line ? ` · ${lineLabel[d.line] ?? d.line}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/entregaveis/${d.id}`} className="ds-focus rounded-ds-input border border-hairline-strong px-3 py-1.5 font-montserrat text-[12px] font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-1)]">Revisar</Link>
                  <form action={approveStudioAction.bind(null, d.id)}><button className="ds-focus rounded-ds-input bg-brand px-3 py-1.5 font-montserrat text-[12px] font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Aprovar</button></form>
                  <form action={rejectStudioAction.bind(null, d.id)} className="flex items-center gap-1">
                    <input name="comment" aria-label="Motivo da reprovação" placeholder="motivo" className="h-8 w-28 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-2 font-montserrat text-[12px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
                    <button className="ds-focus rounded-ds-input border border-hairline-strong px-2.5 py-1.5 font-montserrat text-[12px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Reprovar</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Table<Row> columns={columns} rows={(list ?? []) as Row[]} getKey={(d) => d.id}
          empty={{ title: "Nenhum entregável ainda", description: "Gere o primeiro com IA no painel ao lado — ele nasce em rascunho para sua aprovação.", guiaHref: "/admin/ajuda" }} />

        <div className="space-y-6">
          {/* Gerar com IA — motor de linhas */}
          <Card>
            <div className="mb-3 flex items-center gap-2"><Icon name="sparkles" size={16} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Nova produção</p></div>
            <p className="ds-small mb-4 !mt-0">A IA rascunha com o contexto do programa. Você aprova antes de publicar.</p>
            <form action={generateLineAction} className="space-y-3">
              <div><label className={lbl}>O que produzir</label><Select name="line" required defaultValue={lines[0]?.key}>{FAMILIES.map((f) => <optgroup key={f.key} label={f.label}>{linesInFamily(f.key).map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</optgroup>)}</Select></div>
              <div><label className={lbl}>Cliente</label><Select name="org_id" required defaultValue={soleOrg}>{!soleOrg && <option value="">Selecione…</option>}{(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></div>
              <details>
                <summary className="ds-focus cursor-pointer list-none font-montserrat text-[12px] font-medium text-[color:var(--brand)]">Mais opções (marca, foco)</summary>
                <div className="mt-3 space-y-3">
                  <div><label className={lbl}>Marca</label><Select name="brand" defaultValue="salestrack"><option value="salestrack">Salestrack AI (padrão)</option><option value="andre_kachan">André Kachan</option></Select></div>
                  <div><label className={lbl}>Foco (opcional)</label><Input name="brief" placeholder="Ex.: priorize adoção do Playbook" /></div>
                </div>
              </details>
              <button type="submit" className="ds-focus inline-flex h-10 w-full items-center justify-center gap-2 rounded-ds-input bg-brand font-montserrat text-sm font-semibold text-white shadow-ds-brand transition-colors hover:bg-brand-hover"><Icon name="sparkles" size={15} /> Rascunhar com IA</button>
            </form>
          </Card>

          {/* Criar manual — caminho raro, recolhido */}
          <Card>
            <details>
              <summary className="ds-focus flex cursor-pointer list-none items-center gap-2 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]"><Icon name="pen" size={15} className="text-[color:var(--fg-3)]" /> Criar sem IA (manual)</summary>
            <form action={createManualAction} className="mt-4 space-y-3">
              <div><label className={lbl}>Cliente</label><Select name="org_id" required defaultValue={soleOrg}>{!soleOrg && <option value="">Selecione…</option>}{(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></div>
              <div><label className={lbl}>Tipo</label><Select name="kind" defaultValue="one_pager">{kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</Select></div>
              <div><label className={lbl}>Título</label><Input name="title" placeholder="Ex.: One-pager do programa" required /></div>
              <div><label className={lbl}>Sumário executivo (opcional)</label><Textarea name="summary" rows={3} /></div>
              <button type="submit" className="ds-focus inline-flex h-10 w-full items-center justify-center rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] font-montserrat text-sm font-semibold text-[color:var(--fg-1)] transition-colors hover:bg-[var(--bg-2)]">Criar rascunho</button>
            </form>
            </details>
          </Card>
        </div>
      </div>
    </ContentArea>
  );
}
