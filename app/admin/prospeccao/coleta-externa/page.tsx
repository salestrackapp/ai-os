import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { getSecret } from "@/lib/settings/secrets";
import { ColetaExterna, type ConfigLinha, type FonteLinha, type ExecucaoLinha } from "@/components/admin/ColetaExterna";

export const dynamic = "force-dynamic";

export default async function ColetaExternaPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Prospecção" title="Coleta externa"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const [{ data: cfg }, { data: fontes }, { data: execs }, apify, cookie] = await Promise.all([
    svc.from("coleta_externa_config").select("*").eq("id", "unica").maybeSingle(),
    svc.from("linkedin_fontes").select("*").order("created_at", { ascending: false }),
    svc.from("coleta_externa_execucoes").select("*").order("iniciada_em", { ascending: false }).limit(20),
    getSecret("apify"),
    getSecret("linkedin_li_at"),
  ]);

  const config: ConfigLinha = {
    ativo: cfg?.ativo ?? false,
    actorAtividade: cfg?.actor_atividade ?? null,
    actorReacoes: cfg?.actor_reacoes_post ?? null,
    actorPerfil: cfg?.actor_perfil ?? null,
    usaCookie: cfg?.usa_cookie ?? false,
    tetoDia: cfg?.teto_execucoes_dia ?? 5,
    tetoPerfis: cfg?.teto_perfis_execucao ?? 25,
    paradoAte: cfg?.parado_ate ?? null,
    motivoParada: cfg?.motivo_parada ?? null,
  };

  const linhasFonte: FonteLinha[] = (fontes ?? []).map((x) => ({
    id: x.id, nome: x.nome, url: x.url, tipo: x.tipo, ativa: x.ativa,
    ultimaColeta: x.ultima_coleta, totalPessoas: x.total_pessoas,
  }));

  const linhasExec: ExecucaoLinha[] = (execs ?? []).map((e) => ({
    escopo: e.escopo, alvo: e.alvo, status: e.status, itens: e.itens,
    casados: e.casados, novos: e.novos, custoUsd: e.custo_usd, erro: e.erro, quando: e.iniciada_em,
  }));

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Prospecção", href: "/admin/prospeccao" }, { label: "Coleta externa" }]} className="mb-4" />
      <PageHeader
        eyebrow="Prospecção"
        title="Coleta externa no LinkedIn"
        subtitle="Curtidas e comentários em posts de terceiros, publicações sobre IA e grupos — pelo Apify. É o que os sinais dos seus próprios posts não alcançam, e vem com risco que os outros não têm."
      />
      <ColetaExterna config={config} fontes={linhasFonte} execucoes={linhasExec}
        apifyOk={!!apify} cookieOk={!!cookie} />
    </ContentArea>
  );
}
