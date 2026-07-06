import { z } from "zod";

/** Teste/quiz de uma formação (R3.5). Objetivas têm gabarito; dissertativa é correção manual. */
export const questaoSchema = z.object({
  enunciado: z.string().min(3).max(1000),
  tipo: z.enum(["multipla", "vf", "dissertativa"]),
  alternativas: z.array(z.string().min(1).max(400)).max(6).optional().catch(undefined),
  // gabarito: índice (múltipla, 0-based) | "V"/"F" (vf) | ausente (dissertativa)
  gabarito: z.union([z.number().int(), z.string()]).optional().catch(undefined),
});
export const testeSchema = z.object({
  titulo: z.string().max(200).optional().catch(undefined),
  nota_minima: z.number().min(0).max(100).default(70),
  questoes: z.array(questaoSchema).min(1).max(30),
});
export type Questao = z.infer<typeof questaoSchema>;
export type Teste = z.infer<typeof testeSchema>;

/**
 * Correção automática das OBJETIVAS (gancho de aplicação no portal, R3.5).
 * respostas[i] = índice (múltipla) | "V"/"F" (vf) | texto (dissertativa, ignorada na nota).
 * Retorna acertos/objetivas + nota 0..100 + aprovado (≥ nota_minima).
 */
export function corrigirTeste(teste: Teste, respostas: (string | number | null | undefined)[]): {
  acertos: number; objetivas: number; nota: number; aprovado: boolean; dissertativas: number;
} {
  let acertos = 0, objetivas = 0, dissertativas = 0;
  teste.questoes.forEach((q, i) => {
    if (q.tipo === "dissertativa" || q.gabarito == null) { dissertativas++; return; }
    objetivas++;
    const r = respostas[i];
    const ok = q.tipo === "vf"
      ? String(r).trim().toUpperCase() === String(q.gabarito).trim().toUpperCase()
      : Number(r) === Number(q.gabarito);
    if (ok) acertos++;
  });
  const nota = objetivas ? Math.round((acertos / objetivas) * 100) : 0;
  return { acertos, objetivas, dissertativas, nota, aprovado: objetivas > 0 && nota >= (teste.nota_minima ?? 70) };
}
