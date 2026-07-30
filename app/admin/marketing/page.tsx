import { ContentArea, PageHeader, Card, Badge, EmptyState } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { Campanhas, type CampanhaLinha, type Origem } from "@/components/admin/Campanhas";
import { PainelMarketing, type PontoSerie, type LinhaOrigem, type EtapaFunil } from "@/components/admin/PainelMarketing";

/** Segunda-feira da semana da data — âncora estável para agrupar a série. */
function segunda(d: Date): string {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}
const rotuloSemana = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Marketing" title="Campanhas" subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const [{ data: camps }, { data: origens }, { data: toques }, { data: atrib }, { data: leads }, { data: deals }] = await Promise.all([
    svc.from("campaigns").select("id, nome, canal, status, inicio, fim, custo_centavos, meta_leads, lead_sources(nome)")
      .is("deleted_at", null).order("inicio", { ascending: false }),
    svc.from("lead_sources").select("id, slug, nome").eq("ativo", true).order("nome"),
    svc.from("campaign_touches").select("campaign_id, contact_id"),
    svc.from("deal_attribution").select("deal_id, deal, stage, origem, campanha, ultimo_toque_em, value_estimated"),
    // Contatos com origem = os leads já unificados (dedupe por e-mail). É a verdade única.
    svc.from("contacts").select("id, created_at, lead_source_id, lead_sources(nome)")
      .not("lead_source_id", "is", null).is("deleted_at", null),
    svc.from("deals").select("id, contact_id, stage").is("deleted_at", null),
  ]);

  // leads por campanha = contatos DISTINTOS tocados. Contar toques inflaria: a mesma pessoa
  // pode ser tocada várias vezes pela mesma campanha.
  const porCampanha = new Map<string, Set<string>>();
  for (const t of toques ?? []) {
    const s = porCampanha.get(t.campaign_id as string) ?? new Set<string>();
    s.add(t.contact_id as string);
    porCampanha.set(t.campaign_id as string, s);
  }

  const linhas: CampanhaLinha[] = (camps ?? []).map((c) => ({
    id: c.id, nome: c.nome, canal: c.canal, status: c.status,
    inicio: c.inicio, fim: c.fim, custoCentavos: c.custo_centavos, metaLeads: c.meta_leads,
    origem: (c.lead_sources as unknown as { nome: string } | null)?.nome ?? null,
    leads: porCampanha.get(c.id)?.size ?? 0,
    toques: (toques ?? []).filter((t) => t.campaign_id === c.id).length,
  }));

  // ── Série temporal: leads por semana, uma linha por origem ──────────────────
  const SEMANAS = 8;
  const hoje = new Date();
  const semanas: string[] = [];
  for (let i = SEMANAS - 1; i >= 0; i--) {
    const d = new Date(hoje); d.setUTCDate(d.getUTCDate() - i * 7);
    const s = segunda(d);
    if (!semanas.includes(s)) semanas.push(s);
  }
  const nomeOrigem = (c: { lead_sources: unknown }) =>
    (c.lead_sources as { nome: string } | null)?.nome ?? "Origem não identificada";

  // Só as origens COM lead entram no gráfico: linha reta em zero é ruído, não informação.
  const origensComLead = [...new Set((leads ?? []).map(nomeOrigem))].sort();

  const serie: PontoSerie[] = semanas.map((s) => {
    const ponto: PontoSerie = { periodo: rotuloSemana(s) };
    for (const o of origensComLead) ponto[o] = 0;
    for (const l of leads ?? []) {
      if (segunda(new Date(l.created_at as string)) === s) {
        const o = nomeOrigem(l);
        ponto[o] = Number(ponto[o] ?? 0) + 1;
      }
    }
    return ponto;
  });

  // ── Funil ───────────────────────────────────────────────────────────────────
  const idsComDeal = new Set((deals ?? []).map((d) => d.contact_id).filter(Boolean));
  const clientes = new Set((deals ?? []).filter((d) => d.stage === "cliente").map((d) => d.contact_id));
  const funil: EtapaFunil[] = [
    { etapa: "Leads", qtd: (leads ?? []).length, explica: "capturados pelos sites" },
    { etapa: "Viraram negócio", qtd: (leads ?? []).filter((l) => idsComDeal.has(l.id)).length, explica: "abriram um deal no CRM" },
    { etapa: "Fecharam", qtd: (leads ?? []).filter((l) => clientes.has(l.id)).length, explica: "chegaram a cliente" },
  ];

  // ── Por origem ──────────────────────────────────────────────────────────────
  const custoPorOrigem = new Map<string, number>();
  for (const c of camps ?? []) {
    const nome = (c.lead_sources as unknown as { nome: string } | null)?.nome;
    if (nome) custoPorOrigem.set(nome, (custoPorOrigem.get(nome) ?? 0) + c.custo_centavos);
  }
  const porOrigem: LinhaOrigem[] = origensComLead.map((o) => {
    const daOrigem = (leads ?? []).filter((l) => nomeOrigem(l) === o);
    return {
      origem: o,
      leads: daOrigem.length,
      negocios: daOrigem.filter((l) => idsComDeal.has(l.id)).length,
      custoCentavos: custoPorOrigem.get(o) ?? 0,
    };
  });

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Marketing" }]} className="mb-4" />
      <PageHeader
        eyebrow="Marketing"
        title="Campanhas e origem dos leads"
        subtitle="Quanto cada esforço trouxe de lead, a que custo, e de onde veio quem virou negócio. A atribuição é por último toque antes do negócio existir."
      />

      <Campanhas campanhas={linhas} origens={(origens ?? []) as Origem[]} />

      <section className="mt-8">
        <h2 className="ds-h3 mb-3">Como os leads chegam</h2>
        <PainelMarketing serie={serie} origens={origensComLead} funil={funil} porOrigem={porOrigem} />
      </section>

      <section className="mt-8">
        <h2 className="ds-h3 mb-3">De onde vieram os negócios</h2>
        {(atrib ?? []).length === 0 ? (
          <EmptyState title="Nenhum negócio para atribuir ainda"
            description="Quando um lead virar negócio no CRM, a origem e a campanha que o trouxeram aparecem aqui." />
        ) : (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead><tr>
                  {["Negócio", "Etapa", "Origem", "Campanha", "Último toque"].map((h) => <th key={h} className="th">{h}</th>)}
                </tr></thead>
                <tbody>
                  {(atrib ?? []).map((a) => (
                    <tr key={a.deal_id as string}>
                      <td className="td font-medium text-[color:var(--fg-1)]">{a.deal as string}</td>
                      <td className="td"><Badge tone="neutral">{a.stage as string}</Badge></td>
                      <td className="td text-[color:var(--fg-2)]">{(a.origem as string) ?? "não identificada"}</td>
                      <td className="td text-[color:var(--fg-2)]">{(a.campanha as string) ?? "—"}</td>
                      <td className="td text-[color:var(--fg-2)]">
                        {a.ultimo_toque_em ? new Date(a.ultimo_toque_em as string).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </ContentArea>
  );
}
