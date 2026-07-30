import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

/**
 * Direitos do titular (LGPD, art. 18) — acesso, portabilidade e exclusão.
 *
 * As duas operações pesadas rodam como função no banco, não como sequência de chamadas daqui:
 * uma exclusão que apaga metade das tabelas e falha na outra metade deixa a pessoa num estado
 * pior do que antes. No banco é uma transação — ou tudo, ou nada.
 */

export type Inventario = Record<string, unknown>;

/** Responde ao pedido de acesso e ao de portabilidade: o que existe sobre a pessoa, e onde. */
export async function inventarioTitular(email: string): Promise<Inventario | null> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("fn_lgpd_inventario_titular", { p_email: email });
  if (error) {
    console.error(`[LGPD] inventário falhou para ${email}: ${error.message}`);
    return null;
  }
  await auditService("lgpd.titular.inventario", "dsr_requests", undefined, { email });
  return data as Inventario;
}

/**
 * Executa o direito ao esquecimento.
 *
 * Duas obrigações que não se anulam: apaga-se o que se tratava por consentimento (marketing,
 * prospecção, captura), e preserva-se `audit_logs` mais o que tem sustentação contratual —
 * contrato assinado e proposta emitida são anonimizados no que identificam, não destruídos.
 * A LGPD ressalva expressamente a retenção para cumprimento de obrigação legal e exercício de
 * direitos (art. 16, I e III). Apagar um contrato assinado destruiria prova, não protegeria
 * ninguém.
 */
export async function excluirTitular(email: string): Promise<Inventario | null> {
  const sb = createServiceClient();

  // O inventário é tirado ANTES: depois da exclusão não há mais o que inventariar, e é ele que
  // prova o que foi apagado se a pessoa (ou a ANPD) perguntar depois.
  const antes = await inventarioTitular(email);

  const { data, error } = await sb.rpc("fn_lgpd_excluir_titular", { p_email: email });
  if (error) {
    console.error(`[LGPD] exclusão falhou para ${email}: ${error.message}`);
    return null;
  }
  await auditService("lgpd.titular.excluido", "dsr_requests", undefined, { email, resultado: data });
  return { ...(data as Inventario), inventario_anterior: antes };
}
