/**
 * A proposta ainda vale?
 *
 * Módulo próprio, sem "use server" e sem "server-only", de propósito: a regra é consumida pela
 * página pública E pelas Server Actions dela, e as duas precisam concordar. Quando a validação de
 * prazo morava só na página, uma proposta vencida continuava aprovável pela ação — que é um
 * endpoint, e responde a quem já abriu a página uma vez.
 *
 * O dia da validade conta INTEIRO: vence no fim dele, não na meia-noite que o abre. Quem recebe
 * "válida até 15/08" entende que tem o dia 15 para decidir, e o sistema tem de concordar.
 */
export function propostaVencida(validUntil: string | null, agora = new Date()): boolean {
  if (!validUntil) return false;
  return new Date(`${validUntil}T23:59:59-03:00`) < agora;
}
