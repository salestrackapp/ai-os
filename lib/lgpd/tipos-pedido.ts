/**
 * Os seis direitos do titular, ditos como a pessoa diria.
 *
 * ── Por que módulo puro ───────────────────────────────────────────────────────────────────────
 * Três lugares precisam desta mesma lista: o formulário no navegador (que mostra as opções), o
 * servidor (que valida o que chegou) e o e-mail de confirmação (que repete de volta o que foi
 * pedido). Se cada um tivesse a sua, a divergência apareceria no pior momento possível — a pessoa
 * escolhe uma opção que o servidor não conhece, ou confirma um pedido descrito com outras palavras.
 *
 * ── Por que a chave é o termo da lei e o rótulo não ───────────────────────────────────────────
 * A LGPD fala em "portabilidade", "oposição", "revogação de consentimento". Quem chega na página
 * está incomodado com um e-mail ou preocupado com um dado, e não deveria ter que traduzir a própria
 * vontade para o jargão do artigo 18 antes de ser atendido. O termo técnico viaja na chave — que é
 * o que `dsr_requests.tipo` grava; a frase é o que aparece na tela.
 */

export const TIPOS_PEDIDO = {
  acesso: {
    rotulo: "Quero saber quais dados vocês têm sobre mim",
    curto: "saber quais dados a Salestrack AI tem sobre você",
    ajuda: "Devolvemos a lista do que existe e de onde veio.",
  },
  exclusao: {
    rotulo: "Quero que apaguem meus dados",
    curto: "apagar seus dados",
    ajuda: "Apagamos o que tratamos com seu consentimento. Contrato assinado e registro de auditoria a lei manda guardar — esses são anonimizados, não destruídos.",
  },
  correcao: {
    rotulo: "Tem um dado errado sobre mim",
    curto: "corrigir um dado seu",
    ajuda: "Diga abaixo o que está errado e qual é o certo.",
  },
  portabilidade: {
    rotulo: "Quero receber meus dados em um arquivo",
    curto: "receber seus dados em um arquivo",
    ajuda: "Enviamos em formato aberto, para você levar para onde quiser.",
  },
  oposicao: {
    rotulo: "Não quero que usem meus dados para uma finalidade",
    curto: "se opor a um uso dos seus dados",
    ajuda: "Diga abaixo qual uso incomoda.",
  },
  revogacao: {
    rotulo: "Quero retirar uma autorização que dei",
    curto: "retirar uma autorização que você deu",
    ajuda: "Vale para newsletter e qualquer envio que dependa do seu aceite.",
  },
} as const;

export type TipoPedido = keyof typeof TIPOS_PEDIDO;

/** A ordem em que as opções aparecem na tela — acesso e exclusão primeiro, que são o que 9 em 10 querem. */
export const ORDEM_TIPOS: TipoPedido[] = ["acesso", "exclusao", "correcao", "portabilidade", "oposicao", "revogacao"];

export const ehTipoPedido = (v: unknown): v is TipoPedido => typeof v === "string" && v in TIPOS_PEDIDO;

/** Prazo legal de resposta — art. 19, II. Adotado para todos os tipos, não só para o de acesso. */
export const PRAZO_RESPOSTA_DIAS = 15;
