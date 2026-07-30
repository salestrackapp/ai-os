import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { diasAte } from "@/lib/formato/data";

/**
 * Projeto em stand-by — parado por causa do cliente, não da equipe.
 *
 * ── Por que isto precisa existir ──────────────────────────────────────────────────────────────
 * A IMAGO está com pagamento atrasado e o projeto parou até que ela pague. Sem o conceito, as
 * entregas dela apareceriam como "10 dias de atraso" no painel — atribuindo à equipe uma demora
 * que não é dela, e apagando a informação que de fato importa: estamos parados porque não
 * recebemos.
 *
 * ── O relógio para, mas não zera ──────────────────────────────────────────────────────────────
 * Enquanto o stand-by dura, a entrega não acumula atraso. Quando o projeto volta, os dias parados
 * são somados ao prazo. Os dois lados ficam justos: o cliente não ganha prazo de graça por ter
 * pagado atrasado, e a equipe não carrega atraso que não causou.
 *
 * Isso é diferente de simplesmente adiar a data. Adiar apaga o histórico — daqui a três meses
 * ninguém lembra que houve dois meses de obra parada, e a conversa sobre prazo vira palavra contra
 * palavra. O período fica registrado, com motivo e datas.
 */

export const MOTIVOS: Record<string, string> = {
  inadimplencia: "pagamento em atraso",
  aguardando_cliente: "aguardando o cliente",
  escopo_em_revisao: "escopo em revisão",
  pausa_solicitada: "pausa pedida pelo cliente",
  outro: "outro motivo",
};

export type Standby = {
  projectId: string; orgId: string | null; desde: string; motivo: string;
  diasParado: number; diasAcumulados: number;
};

/** Projetos parados agora. Quem abre a semana precisa ver isto antes de cobrar a equipe. */
export async function projetosEmStandby(): Promise<(Standby & { cliente: string })[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("projects")
    .select("id, org_id, standby_desde, standby_motivo, standby_dias_acumulados, organizations(name)")
    .not("standby_desde", "is", null);

  return (data ?? []).map((p) => ({
    projectId: p.id as string,
    orgId: p.org_id as string | null,
    cliente: (p.organizations as unknown as { name: string } | null)?.name ?? "—",
    desde: p.standby_desde as string,
    motivo: (p.standby_motivo as string) ?? "outro",
    diasParado: Math.abs(diasAte(p.standby_desde as string) ?? 0),
    diasAcumulados: (p.standby_dias_acumulados as number) ?? 0,
  }));
}

export async function estaEmStandby(projectId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb.from("projects").select("standby_desde").eq("id", projectId).maybeSingle();
  return !!data?.standby_desde;
}

/**
 * Coloca o projeto em stand-by.
 *
 * `desde` é a data em que a obra REALMENTE parou, não a de hoje: quem registra costuma fazê-lo
 * dias depois, e usar a data do registro encurtaria o período parado — justamente o número que
 * sustenta a conversa sobre prazo.
 */
export async function pararProjeto(dados: {
  projectId: string; motivo: string; desde: string; observacao?: string | null; autor?: string | null;
}): Promise<void> {
  const sb = createServiceClient();
  const { data: proj } = await sb.from("projects")
    .select("id, org_id, standby_desde").eq("id", dados.projectId).maybeSingle();
  if (!proj) throw new Error("Projeto não encontrado.");
  if (proj.standby_desde) throw new Error("Este projeto já está em stand-by.");

  await sb.from("projects").update({
    standby_desde: dados.desde, standby_motivo: dados.motivo,
  }).eq("id", dados.projectId);

  await sb.from("projeto_standby_periodos").insert({
    project_id: dados.projectId, org_id: proj.org_id, motivo: dados.motivo,
    observacao: dados.observacao ?? null, inicio: dados.desde, created_by: dados.autor ?? null,
  });

  await auditService("projeto.standby.iniciado", "projects", dados.projectId,
    { motivo: dados.motivo, desde: dados.desde }, proj.org_id as string);
}

/**
 * Retoma o projeto e empurra os prazos pelos dias parados.
 *
 * Só as entregas AINDA NÃO entregues são empurradas. Mexer no prazo do que já foi entregue
 * reescreveria a história — e o histórico de pontualidade é o que sustenta a próxima negociação.
 */
export async function retomarProjeto(projectId: string, autor?: string | null): Promise<{ dias: number; entregasAjustadas: number }> {
  const sb = createServiceClient();
  const { data: proj } = await sb.from("projects")
    .select("id, org_id, standby_desde, standby_dias_acumulados").eq("id", projectId).maybeSingle();
  if (!proj?.standby_desde) throw new Error("Este projeto não está em stand-by.");

  const hoje = new Date().toISOString().slice(0, 10);
  const dias = Math.max(0, Math.abs(diasAte(proj.standby_desde as string) ?? 0));

  const { data: periodo } = await sb.from("projeto_standby_periodos")
    .select("id").eq("project_id", projectId).is("fim", null)
    .order("inicio", { ascending: false }).limit(1).maybeSingle();
  if (periodo) {
    await sb.from("projeto_standby_periodos").update({ fim: hoje, dias }).eq("id", periodo.id);
  }

  await sb.from("projects").update({
    standby_desde: null, standby_motivo: null,
    standby_dias_acumulados: ((proj.standby_dias_acumulados as number) ?? 0) + dias,
  }).eq("id", projectId);

  // Empurra o prazo do que ainda não foi entregue, pelos dias em que ninguém pôde trabalhar.
  let entregasAjustadas = 0;
  if (dias > 0) {
    const { data: pendentes } = await sb.from("deliverables")
      .select("id, due_date").eq("project_id", projectId)
      .is("deleted_at", null).is("delivered_at", null).not("due_date", "is", null);

    for (const e of pendentes ?? []) {
      const novo = new Date((e.due_date as string) + "T00:00:00Z");
      novo.setUTCDate(novo.getUTCDate() + dias);
      await sb.from("deliverables")
        .update({ due_date: novo.toISOString().slice(0, 10), updated_at: new Date().toISOString() })
        .eq("id", e.id);
      entregasAjustadas++;
    }
  }

  await auditService("projeto.standby.retomado", "projects", projectId,
    { dias, entregas_ajustadas: entregasAjustadas, autor }, proj.org_id as string);
  return { dias, entregasAjustadas };
}
