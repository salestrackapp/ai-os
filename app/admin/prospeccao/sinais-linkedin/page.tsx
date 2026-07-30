import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { SinaisLinkedIn, type PostLinha, type InteracaoLinha } from "@/components/admin/SinaisLinkedIn";

export const dynamic = "force-dynamic";

export default async function SinaisLinkedInPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Prospecção" title="Sinais do LinkedIn"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const [{ data: posts }, { data: inters }] = await Promise.all([
    svc.from("linkedin_posts").select("id, titulo, url, tema_ia, publicado_em, reacoes, comentarios")
      .order("publicado_em", { ascending: false, nullsFirst: false }),
    svc.from("linkedin_interacoes")
      .select("id, tipo, nome, cargo, empresa, perfil_url, ocorreu_em, prospect_id, linkedin_posts(titulo)")
      .order("ocorreu_em", { ascending: false }).limit(200),
  ]);

  const linhasPost: PostLinha[] = (posts ?? []).map((p) => ({
    id: p.id, titulo: p.titulo, url: p.url, temaIa: p.tema_ia,
    publicadoEm: p.publicado_em, reacoes: p.reacoes, comentarios: p.comentarios,
  }));

  const todas: InteracaoLinha[] = (inters ?? []).map((i) => ({
    id: i.id, tipo: i.tipo, nome: i.nome, cargo: i.cargo, empresa: i.empresa,
    perfilUrl: i.perfil_url, quando: i.ocorreu_em, prospectId: i.prospect_id,
    post: (i.linkedin_posts as unknown as { titulo: string } | null)?.titulo ?? "—",
  }));

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Prospecção", href: "/admin/prospeccao" }, { label: "Sinais do LinkedIn" }]} className="mb-4" />
      <PageHeader
        eyebrow="Prospecção"
        title="Sinais do LinkedIn"
        subtitle="Quem curte, comenta ou compartilha seus posts sobre IA está declarando duas coisas: que o tema interessa e que já conhece você. É o sinal mais forte que existe para saber quem tem propriedade no assunto."
      />

      <Card className="mb-6">
        <p className="ds-body"><b>De onde vem — e o que não dá para vir.</b></p>
        <p className="ds-small mt-2">
          O que entra aqui são as reações e comentários <b>nos seus próprios posts</b>. O post é seu,
          a lista de quem reagiu é sua, e o LinkedIn a mostra para você — não há termo de uso no
          caminho e nenhuma conta corre risco.
        </p>
        <p className="ds-small mt-2">
          <b>Não dá</b> para trazer curtidas em posts de terceiros, participação em grupos nem
          mensagens privadas: nenhuma API expõe as duas primeiras (só raspando, o que arrisca a
          conta), e a terceira é comunicação privada, sem base legal possível. O que o Apollo
          complementa é o contexto da empresa — vagas abertas na área e ferramentas de IA em uso.
        </p>
      </Card>

      <SinaisLinkedIn
        posts={linhasPost}
        naBase={todas.filter((i) => i.prospectId)}
        foraDaBase={todas.filter((i) => !i.prospectId)}
      />
    </ContentArea>
  );
}
