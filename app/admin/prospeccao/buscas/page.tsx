import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { apolloConfigured } from "@/lib/apollo";
import { BuscasProspeccao, type BuscaLinha, type ExecucaoLinha } from "@/components/admin/BuscasProspeccao";

export const dynamic = "force-dynamic";

export default async function BuscasPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Prospecção" title="Buscas automáticas"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const [{ data: buscas }, { data: execs }, apolloOk] = await Promise.all([
    svc.from("prospect_buscas")
      .select("id, nome, icp, ativa, cargos, locais, setores, porte, meta_por_execucao, teto_enriquecimento, ultima_execucao, total_coletado, ultimo_erro")
      .is("deleted_at", null).order("created_at", { ascending: false }),
    svc.from("prospect_busca_execucoes")
      .select("iniciada_em, vistos, criados, duplicados, recusados_pessoal, enriquecidos, erro, prospect_buscas(nome)")
      .order("iniciada_em", { ascending: false }).limit(15),
    apolloConfigured(),
  ]);

  const linhas: BuscaLinha[] = (buscas ?? []).map((b) => ({
    id: b.id, nome: b.nome, icp: b.icp, ativa: b.ativa,
    cargos: b.cargos ?? [], locais: b.locais ?? [], setores: b.setores ?? [], porte: b.porte ?? [],
    metaPorExecucao: b.meta_por_execucao, tetoEnriquecimento: b.teto_enriquecimento,
    ultimaExecucao: b.ultima_execucao, totalColetado: b.total_coletado, ultimoErro: b.ultimo_erro,
  }));

  const execucoes: ExecucaoLinha[] = (execs ?? []).map((e) => ({
    busca: (e.prospect_buscas as unknown as { nome: string } | null)?.nome ?? "—",
    quando: e.iniciada_em, vistos: e.vistos, criados: e.criados, duplicados: e.duplicados,
    recusados: e.recusados_pessoal, enriquecidos: e.enriquecidos, erro: e.erro,
  }));

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Prospecção", href: "/admin/prospeccao" }, { label: "Buscas automáticas" }]} className="mb-4" />
      <PageHeader
        eyebrow="Prospecção"
        title="Buscas automáticas"
        subtitle="O sistema traz sozinho, todo dia, pessoas com o perfil que você definir — pelo Apollo, com dado profissional corporativo, e com a base legal registrada junto."
      />

      <Card className="mb-6">
        <p className="ds-body">
          <b>De onde vêm os dados.</b> A coleta usa o <b>Apollo</b>, que é fonte licenciada — não
          raspamos perfis com a sua conta do LinkedIn. Isso não é detalhe: raspar contraria os
          termos da plataforma, e conta bloqueada não volta.
        </p>
        <p className="ds-small mt-2">
          Entram apenas nome, cargo, empresa, e-mail corporativo, telefone e o endereço do perfil
          público. Caixa de provedor gratuito é recusada pelo próprio banco. A base legal é
          legítimo interesse em prospecção B2B, com teste de proporcionalidade escrito, aviso de
          origem no primeiro contato, saída em um clique e descarte automático em 180 dias para
          quem não responder.
        </p>
      </Card>

      <BuscasProspeccao buscas={linhas} execucoes={execucoes} apolloOk={apolloOk} />
    </ContentArea>
  );
}
