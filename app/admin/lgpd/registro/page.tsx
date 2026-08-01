import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { RegistroTratamento, type OperacaoLinha, type OperadorLinha } from "@/components/admin/RegistroTratamento";

export const dynamic = "force-dynamic";

/**
 * O registro de operações de tratamento (art. 37).
 *
 * Usa service role e não o cliente sob RLS, diferente da página pública, por um motivo só: aqui a
 * lista precisa mostrar TAMBÉM o que está desligado — um operador inativo é justamente o que
 * alguém vai querer religar. A policy pública filtra por `ativo`, e faz certo.
 */
export default async function RegistroPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Privacidade" title="Registro de tratamento"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const [{ data: ops }, { data: opers }] = await Promise.all([
    svc.from("tratamento_operacoes")
      .select("chave, nome, finalidade, base_legal, titulares, dados, origem, compartilhamento, retencao, onde_no_sistema, observacao")
      .eq("ativo", true).order("ordem"),
    svc.from("tratamento_operadores").select("chave, nome, papel, dados, pais, site, ativo").order("ordem"),
  ]);

  const operacoes: OperacaoLinha[] = (ops ?? []).map((o) => ({
    chave: o.chave, nome: o.nome, finalidade: o.finalidade, baseLegal: o.base_legal,
    titulares: o.titulares, dados: o.dados, origem: o.origem,
    compartilhamento: o.compartilhamento, retencao: o.retencao,
    ondeNoSistema: o.onde_no_sistema, observacao: o.observacao,
  }));
  const operadores: OperadorLinha[] = (opers ?? []).map((o) => ({
    chave: o.chave, nome: o.nome, papel: o.papel, dados: o.dados,
    pais: o.pais, site: o.site, ativo: o.ativo,
  }));

  return (
    <ContentArea>
      <Breadcrumbs items={[
        { label: "Admin", href: "/admin/hoje" },
        { label: "Configurar", href: "/admin/configuracoes" },
        { label: "Dados pessoais", href: "/admin/lgpd" },
        { label: "Registro de tratamento" },
      ]} className="mb-4" />
      <PageHeader
        eyebrow="Privacidade · LGPD art. 37"
        title="O que a Salestrack trata, e por quê"
        subtitle="O registro das operações de tratamento — o documento que a ANPD pede primeiro numa fiscalização, e que a diligência de um cliente grande pede antes de assinar. Também é o texto que alimenta a política de privacidade pública."
      />

      {operacoes.length === 0 ? (
        <Card>
          <p className="ds-body">
            O registro está vazio. Carregue a semente versionada no código — ela descreve as
            operações que o sistema realmente executa hoje.
          </p>
          <div className="mt-4">
            <RegistroTratamento operacoes={[]} operadores={operadores} />
          </div>
        </Card>
      ) : (
        <RegistroTratamento operacoes={operacoes} operadores={operadores} />
      )}
    </ContentArea>
  );
}
