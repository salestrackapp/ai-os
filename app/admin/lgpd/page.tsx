import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { PainelLgpd, type PedidoLinha } from "@/components/admin/PainelLgpd";
import { EMAIL_ENCARREGADO, NOME_ENCARREGADO } from "@/lib/lgpd/contato";

export const dynamic = "force-dynamic";

export default async function LgpdPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Privacidade" title="Dados pessoais"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const { data: pedidos } = await svc.from("dsr_requests")
    .select("id, tipo, status, email, nome, detalhe, resposta, recebido_em, prazo_em, concluido_em")
    .order("concluido_em", { ascending: true, nullsFirst: true })
    .order("prazo_em", { ascending: true });

  const linhas: PedidoLinha[] = (pedidos ?? []).map((p) => ({
    id: p.id, tipo: p.tipo, status: p.status, email: p.email, nome: p.nome,
    detalhe: p.detalhe, resposta: p.resposta,
    recebidoEm: p.recebido_em, prazoEm: p.prazo_em, concluidoEm: p.concluido_em,
  }));

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Configurar", href: "/admin/configuracoes" }, { label: "Dados pessoais" }]} className="mb-4" />
      <PageHeader
        eyebrow="Privacidade · LGPD"
        title="Dados pessoais e direitos do titular"
        subtitle="Quem pediu o quê, o prazo de cada pedido, e o que existe sobre cada pessoa. A lei dá 15 dias para responder um pedido de acesso — aqui a contagem é automática."
      />

      <Card className="mb-6">
        <p className="ds-body">
          <b>Encarregado de dados (DPO):</b> André Kachan ·{" "}
          <a className="underline" href={`mailto:${EMAIL_ENCARREGADO}`}>{EMAIL_ENCARREGADO}</a>
        </p>
        <p className="ds-small mt-2">
          É o contato que a LGPD exige publicar (art. 41). Todo pedido que chega por esse endereço
          deve ser registrado aqui — é o registro que prova que foi atendido, e dentro do prazo.
        </p>
      </Card>

      <PainelLgpd pedidos={linhas} />
    </ContentArea>
  );
}
