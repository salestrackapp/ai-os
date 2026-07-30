import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

/**
 * Biblioteca de cláusulas.
 *
 * ── De onde ela veio ──────────────────────────────────────────────────────────────────────────
 * Do contrato Salestrack/IMAGO de 07/07/2026 — o único assinado, e o único que já foi negociado
 * de verdade. Antes disso, fazer o segundo contrato era copiar e colar o primeiro; quando uma
 * cláusula mudasse, ninguém saberia em quais minutas ela estava.
 *
 * ── Por que versionar, e por que congelar ─────────────────────────────────────────────────────
 * Editar a multa hoje não pode reescrever o que a IMAGO assinou. Duas defesas:
 *  · `clausula_versoes` guarda toda redação anterior (gatilho no banco, não na aplicação);
 *  · `contrato_clausulas` congela o TEXTO no momento da assinatura. O contrato assinado não
 *    aponta para a biblioteca — ele carrega a própria cópia.
 *
 * Sem o congelamento, um contrato de julho passaria a "dizer" o que a biblioteca diz em dezembro.
 * É a diferença entre um repositório de modelos e uma máquina de reescrever o passado.
 */

export type Clausula = {
  id: string; codigo: string; ordem: number; titulo: string; categoria: string;
  texto: string; variaveis: string[]; obrigatoria: boolean; vigente: boolean; versao: number;
  observacao_interna: string | null;
};

export const CATEGORIAS: Record<string, string> = {
  objeto: "Objeto", prazo: "Prazo", comercial: "Comercial", manutencao: "Manutenção",
  obrigacoes: "Obrigações", propriedade: "Propriedade intelectual",
  confidencialidade: "Confidencialidade", lgpd: "LGPD", vigencia: "Vigência",
  geral: "Disposições gerais", foro: "Foro",
};

export async function listarClausulas(): Promise<Clausula[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("clausulas").select("*").order("ordem");
  return (data ?? []) as Clausula[];
}

/** Variáveis que a minuta precisa e que ninguém preencheu. É o que impede minuta com {{buraco}}. */
export function variaveisFaltantes(clausulas: Clausula[], valores: Record<string, string>): string[] {
  const pedidas = new Set(clausulas.flatMap((c) => c.variaveis));
  return [...pedidas].filter((v) => !valores[v]?.trim());
}

/**
 * Monta a minuta substituindo as variáveis.
 *
 * Variável sem valor NÃO vira string vazia: fica visível como `⟨nome⟩`, para o buraco aparecer na
 * revisão em vez de virar um contrato que diz "no valor de ." — que é o erro que ninguém percebe
 * antes de mandar para assinatura.
 */
export function montarMinuta(clausulas: Clausula[], valores: Record<string, string>): string {
  return clausulas
    .filter((c) => c.vigente)
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => {
      const corpo = c.texto.replace(/\{\{(\w+)\}\}/g, (_, nome) =>
        valores[nome]?.trim() || `⟨${nome}⟩`);
      return `CLÁUSULA — ${c.titulo.toUpperCase()}\n\n${corpo}`;
    })
    .join("\n\n");
}

/**
 * Congela as cláusulas vigentes num contrato.
 *
 * Chamado na assinatura, uma vez. Reexecutar não sobrescreve o que já foi congelado — um contrato
 * assinado que mudasse de conteúdo depois não seria mais um contrato.
 */
export async function congelarNoContrato(contractId: string, valores: Record<string, string>): Promise<number> {
  const sb = createServiceClient();
  const { count: jaTem } = await sb.from("contrato_clausulas")
    .select("id", { count: "exact", head: true }).eq("contract_id", contractId);
  if ((jaTem ?? 0) > 0) return 0;

  const clausulas = (await listarClausulas()).filter((c) => c.vigente);
  const linhas = clausulas.map((c) => ({
    contract_id: contractId, clausula_id: c.id, versao: c.versao, ordem: c.ordem,
    texto_congelado: c.texto.replace(/\{\{(\w+)\}\}/g, (_, n) => valores[n]?.trim() || `⟨${n}⟩`),
  }));
  const { error } = await sb.from("contrato_clausulas").insert(linhas);
  if (error) throw new Error(error.message);

  await auditService("juridico.clausulas.congeladas", "contracts", contractId, { clausulas: linhas.length });
  return linhas.length;
}

/** As cláusulas COMO ESTÃO no contrato assinado — não como estão na biblioteca hoje. */
export async function clausulasDoContrato(contractId: string): Promise<{ ordem: number; texto: string }[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("contrato_clausulas")
    .select("ordem, texto_congelado").eq("contract_id", contractId).order("ordem");
  return (data ?? []).map((c) => ({ ordem: c.ordem as number, texto: c.texto_congelado as string }));
}
