import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { Administracao, type FornecedorLinha, type DespesaLinha } from "@/components/admin/Administracao";
import { SaudeDosCrons } from "@/components/admin/SaudeDosCrons";
import { saudeDosCrons } from "@/lib/ops/cron";

export const dynamic = "force-dynamic";

export default async function AdministracaoPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Administração" title="Custos, fornecedores e rotinas"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const saude = await saudeDosCrons();
  const [{ data: forn }, { data: desp }] = await Promise.all([
    svc.from("vendors").select("id, nome, categoria, site, ativo").order("nome"),
    svc.from("despesas")
      .select("id, descricao, categoria, recorrencia, valor_centavos, inicio, revisada_em, observacao, ativa, vendors(nome)")
      .order("ativa", { ascending: false }).order("valor_centavos", { ascending: false }),
  ]);

  // O custo mensal equivalente é calculado aqui e no banco (view) — aqui porque a lista mostra
  // encerradas também, e a view só traz as ativas.
  const mensal = (valor: number, rec: string) =>
    rec === "mensal" ? valor : rec === "anual" ? Math.round(valor / 12)
    : rec === "trimestral" ? Math.round(valor / 3) : 0;

  const despesas: DespesaLinha[] = (desp ?? []).map((d) => ({
    id: d.id, descricao: d.descricao, categoria: d.categoria, recorrencia: d.recorrencia,
    valorCentavos: d.valor_centavos, custoMensalCentavos: mensal(d.valor_centavos, d.recorrencia),
    inicio: d.inicio, revisadaEm: d.revisada_em, observacao: d.observacao, ativa: d.ativa,
    fornecedor: (d.vendors as unknown as { nome: string } | null)?.nome ?? null,
  }));

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Administração" }]} className="mb-4" />
      <PageHeader
        eyebrow="Administração"
        title="Custos, fornecedores e rotinas"
        subtitle="O que roda sozinho, o que a Salestrack gasta por mês e com quem. As duas coisas somem da vista pelo mesmo motivo: funcionam até pararem de funcionar, em silêncio."
      />
      {/* A saúde das rotinas vem ANTES dos custos: é o que pode estar quebrado agora. */}
      <SaudeDosCrons saude={saude} />

      <Administracao fornecedores={(forn ?? []) as FornecedorLinha[]} despesas={despesas} />
    </ContentArea>
  );
}
