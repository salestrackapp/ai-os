import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { Juridico, type ClausulaLinha, type DemandaLinha, type OrgOpcao } from "@/components/admin/Juridico";

export const dynamic = "force-dynamic";

export default async function JuridicoPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Jurídico" title="Cláusulas e demandas"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const [{ data: cls }, { data: dem }, { data: orgs }] = await Promise.all([
    svc.from("clausulas").select("*").order("ordem"),
    svc.from("legal_matters")
      .select("id, tipo, titulo, descricao, status, prioridade, prazo, concluida_em, organizations(name)")
      .order("prazo", { ascending: true, nullsFirst: false }),
    svc.from("organizations").select("id, name").eq("is_salestrack", false).order("name"),
  ]);

  const clausulas: ClausulaLinha[] = (cls ?? []).map((c) => ({
    id: c.id, codigo: c.codigo, titulo: c.titulo, categoria: c.categoria, texto: c.texto,
    variaveis: c.variaveis ?? [], vigente: c.vigente, versao: c.versao,
    observacao: c.observacao_interna,
  }));

  const demandas: DemandaLinha[] = (dem ?? []).map((d) => ({
    id: d.id, tipo: d.tipo, titulo: d.titulo, descricao: d.descricao, status: d.status,
    prioridade: d.prioridade, prazo: d.prazo, concluidaEm: d.concluida_em,
    cliente: (d.organizations as unknown as { name: string } | null)?.name ?? null,
  }));

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Jurídico" }]} className="mb-4" />
      <PageHeader
        eyebrow="Jurídico"
        title="Cláusulas e demandas"
        subtitle="A biblioteca que alimenta as minutas, e o que tem prazo para responder. Cada edição de cláusula guarda a versão anterior — contrato já assinado não muda."
      />

      <Card className="mb-6">
        <p className="ds-body">
          <b>Regra de inadimplência vigente (desde 30/07/2026):</b> multa de <b>10%</b> sobre o valor
          em atraso, juros de 1% ao mês e correção pelo IPCA. Vencidas <b>2 faturas</b>, o contrato
          entra em <b>cancelamento provisório</b> — os serviços são suspensos até a quitação, e os
          prazos ficam pausados pelo período.
        </p>
        <p className="ds-small mt-2">
          O contrato da IMAGO foi assinado em 07/07/2026 com a regra anterior (multa de 2%, suspensão
          após 10 dias). A cláusula 11.5 dele exige termo aditivo para mudar — então a regra nova
          vale para contratos novos, e a IMAGO só migra se assinar o aditivo.
        </p>
      </Card>

      <Juridico clausulas={clausulas} demandas={demandas}
        orgs={(orgs ?? []).map((o): OrgOpcao => ({ id: o.id, nome: o.name }))} />
    </ContentArea>
  );
}
