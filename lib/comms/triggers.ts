import { z } from "zod";

/**
 * Contratos de gatilho da régua (R4.1) — DEFINIÇÃO. A AVALIAÇÃO/disparo é R4.3.
 * Tempo (offset/data), Evento (marco/entregável/sessão/provisionamento), Estado (inatividade/engajamento).
 */

export const gatilhoTempo = z.object({
  tipo: z.literal("tempo"),
  quando: z.enum(["apos_inicio_fase", "apos_inicio_programa", "data_fixa"]),
  offset_dias: z.number().int().min(0).max(365).optional(),
  data: z.string().max(20).optional(), // ISO date (data_fixa)
});

export const EVENTOS = ["marco_concluido", "entregavel_aprovado", "sessao_agendada", "sessao_realizada", "programa_provisionado"] as const;
export const gatilhoEvento = z.object({
  tipo: z.literal("evento"),
  evento: z.enum(EVENTOS),
});

export const gatilhoEstado = z.object({
  tipo: z.literal("estado"),
  condicao: z.enum(["inatividade", "baixo_engajamento"]),
  dias_limite: z.number().int().min(1).max(180).optional(),
  limiar: z.number().min(0).max(100).optional(),
});

export const gatilhoSchema = z.discriminatedUnion("tipo", [gatilhoTempo, gatilhoEvento, gatilhoEstado]).superRefine((g, ctx) => {
  if (g.tipo === "tempo" && (g.quando === "data_fixa" ? !g.data : g.offset_dias == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe offset_dias (relativo) ou data (data_fixa)." });
  }
});
export type Gatilho = z.infer<typeof gatilhoSchema>;

export function validarGatilho(g: unknown): { ok: boolean; error?: string } {
  const r = gatilhoSchema.safeParse(g);
  return r.success ? { ok: true } : { ok: false, error: r.error.issues[0]?.message ?? "Gatilho inválido." };
}

/** Rótulo legível de um gatilho (para o editor/timeline). */
export function gatilhoLabel(g: Gatilho): string {
  if (g.tipo === "tempo") {
    if (g.quando === "data_fixa") return `Em ${g.data}`;
    return `${g.offset_dias ?? 0} dia(s) após ${g.quando === "apos_inicio_fase" ? "o início da fase" : "o início do programa"}`;
  }
  if (g.tipo === "evento") {
    const m: Record<string, string> = { marco_concluido: "Marco concluído", entregavel_aprovado: "Entregável aprovado", sessao_agendada: "Sessão agendada", sessao_realizada: "Sessão realizada", programa_provisionado: "Programa provisionado" };
    return `Quando: ${m[g.evento] ?? g.evento}`;
  }
  return `Estado: ${g.condicao === "inatividade" ? `inatividade ≥ ${g.dias_limite ?? "?"}d` : `engajamento < ${g.limiar ?? "?"}%`}`;
}
