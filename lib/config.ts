import "server-only";

/**
 * Modelo comercial (fonte da verdade): NÃO há mensalidade de plataforma sendo comercializada.
 * O que se vende são as OFERTAS das propostas; o AI OS é o veículo de entrega. Acesso do cliente
 * vem do PROGRAMA PROVISIONADO (proposta aceita, Fase 8) — nunca de assinatura/plano.
 *
 * Reversível: com PLATFORM_SUBSCRIPTION_ENABLED=true, a lógica de planos/mensalidade/gating da
 * Fase 6 volta a valer (nada foi apagado — tabelas e Stripe seguem intactos).
 */
export function platformSubscriptionEnabled(): boolean {
  return process.env.PLATFORM_SUBSCRIPTION_ENABLED === "true";
}
