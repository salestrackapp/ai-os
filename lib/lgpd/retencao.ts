import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

/**
 * Retenção com prazo na base de prospecção.
 *
 * É o item do balanceamento que costuma ser esquecido — e é o que derruba o legítimo interesse
 * quando alguém olha de perto. Guardar indefinidamente o dado de quem nunca respondeu não serve a
 * nenhuma finalidade legítima: serve à comodidade de quem coletou. A LGPD exige que o tratamento
 * termine quando a finalidade se esgota (art. 15, I).
 *
 * Prazo: 180 dias a contar da coleta, carimbado em `prospects.retencao_ate`.
 *
 * NÃO descarta quem:
 *  · virou negócio (`deal_id`) — aí a finalidade mudou e há relação comercial
 *  · respondeu (`status` diferente de novo/abordado) — houve interação real
 *
 * Descarta, sim, quem se opôs — e imediatamente, sem esperar prazo. Quem disse não não deve
 * continuar na base pelo resto do semestre.
 */
export type ResultadoRetencao = { descartados: number; porOposicao: number };

export async function aplicarRetencao(limite = 500): Promise<ResultadoRetencao> {
  const sb = createServiceClient();
  const agora = new Date().toISOString();

  // 1) Oposição: sai na hora.
  const { data: opostos } = await sb.from("prospects")
    .select("id, email").not("oposicao_em", "is", null).is("deal_id", null).limit(limite);
  const idsOpostos = (opostos ?? []).map((p) => p.id as string);

  // 2) Prazo vencido sem conversa nenhuma.
  const { data: vencidos } = await sb.from("prospects")
    .select("id, email")
    .lt("retencao_ate", agora)
    .is("deal_id", null)
    .in("status", ["novo", "abordado"])
    .limit(limite);
  const idsVencidos = (vencidos ?? []).map((p) => p.id as string);

  const ids = [...new Set([...idsOpostos, ...idsVencidos])];
  if (ids.length === 0) return { descartados: 0, porOposicao: 0 };

  // Dependentes primeiro — FK não perdoa ordem errada.
  await sb.from("outreach_messages").delete().in("prospect_id", ids);
  await sb.from("cadence_enrollments").delete().in("prospect_id", ids);
  await sb.from("timeline_events").delete().eq("subject_type", "prospect").in("subject_id", ids);
  const { error } = await sb.from("prospects").delete().in("id", ids);
  if (error) {
    console.error(`[LGPD] retenção falhou: ${error.message}`);
    return { descartados: 0, porOposicao: 0 };
  }

  // O consentimento não some junto: fica como prova de que o tratamento existiu e terminou.
  const emails = [...(opostos ?? []), ...(vencidos ?? [])]
    .map((p) => p.email as string | null).filter(Boolean) as string[];
  for (const email of [...new Set(emails)]) {
    await sb.from("consent_records")
      .update({ estado: "revogado", revogado_em: agora, updated_at: agora })
      .ilike("email", email).eq("finalidade", "prospeccao").neq("estado", "revogado");
  }

  await auditService("lgpd.retencao.aplicada", "prospects", undefined, {
    descartados: ids.length, por_oposicao: idsOpostos.length,
  });
  return { descartados: ids.length, porOposicao: idsOpostos.length };
}
