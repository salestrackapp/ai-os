import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { Entregas, type EntregaLinha, type OrgOpcao } from "@/components/admin/Entregas";
import { diasDeAtraso } from "@/lib/formato/data";
import { projetosEmStandby } from "@/lib/entregas/standby";

export const dynamic = "force-dynamic";

/**
 * Atraso é dado objetivo — prazo no passado e sem entrega —, **exceto quando o projeto está em
 * stand-by**. Uma entrega parada porque o cliente não pagou não é atraso nosso, e contá-la como
 * tal atribui à equipe uma demora que não é dela.
 */
function calcularAtraso(prazo: string | null, entregueEm: string | null, emStandby: boolean): number | null {
  if (emStandby) return null;
  return diasDeAtraso(prazo, entregueEm);
}

export default async function EntregasPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Entregas" title="Escopo e entregas"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const [{ data: entregas }, { data: orgs }, standby] = await Promise.all([
    svc.from("deliverables")
      .select("id, org_id, project_id, title, frente, status, due_date, delivered_at, observacao, ultimo_motivo, organizations(name)")
      .is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
    svc.from("organizations").select("id, name").eq("is_salestrack", false).order("name"),
    projetosEmStandby(),
  ]);

  // O histórico vem numa consulta só, não uma por entrega: com dezenas de entregas, o laço viraria
  // dezenas de idas ao banco para desenhar uma tela.
  const { data: eventos } = await svc.from("deliverable_eventos")
    .select("deliverable_id, de, para, motivo, created_at")
    .order("created_at", { ascending: false });
  const historicoPorEntrega = new Map<string, { de: string | null; para: string; motivo: string | null; quando: string }[]>();
  for (const ev of eventos ?? []) {
    const k = ev.deliverable_id as string;
    const lista = historicoPorEntrega.get(k) ?? [];
    lista.push({ de: ev.de, para: ev.para, motivo: ev.motivo, quando: ev.created_at });
    historicoPorEntrega.set(k, lista);
  }

  const paradosPorProjeto = new Map(standby.map((s) => [s.projectId, s]));

  const linhas: EntregaLinha[] = (entregas ?? []).map((e) => {
    const parado = paradosPorProjeto.get(e.project_id as string);
    return {
      id: e.id, orgId: e.org_id, projectId: e.project_id,
      cliente: (e.organizations as unknown as { name: string } | null)?.name ?? "—",
      titulo: e.title, frente: e.frente, status: e.status,
      prazo: e.due_date, entregueEm: e.delivered_at, observacao: e.observacao,
      ultimoMotivo: e.ultimo_motivo,
      historico: historicoPorEntrega.get(e.id as string) ?? [],
      diasDeAtraso: calcularAtraso(e.due_date, e.delivered_at, !!parado),
      standby: parado ? { desde: parado.desde, motivo: parado.motivo, dias: parado.diasParado } : null,
    };
  });

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Jornadas", href: "/admin/jornadas" }, { label: "Escopo e entregas" }]} className="mb-4" />
      <PageHeader
        eyebrow="Entregas"
        title="O que foi vendido, o que foi entregue"
        subtitle="Cadastre o que o contrato promete. O atraso é calculado a partir do prazo — e o relógio para enquanto o projeto estiver em stand-by, porque espera causada pelo cliente não é atraso da equipe."
      />
      <Entregas
        linhas={linhas}
        orgs={(orgs ?? []).map((o): OrgOpcao => ({ id: o.id, nome: o.name }))}
        standby={standby.map((s) => ({
          projectId: s.projectId, cliente: s.cliente, desde: s.desde,
          motivo: s.motivo, dias: s.diasParado,
        }))}
      />
    </ContentArea>
  );
}
