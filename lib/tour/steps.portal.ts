import type { TourStep } from "./types";

/**
 * Caminho de ouro do PORTAL (cliente): boas-vindas → Jornada ("você está aqui") →
 * Copilotos (proativos) → Automações → Visão geral (resultados) → passo interativo:
 * falar com o Consultor / ver o passo atual. Tom copiloto que acalma e conduz. PT.
 * Alvos reais via data-tour (existem em /portal).
 */
export const PORTAL_STEPS: TourStep[] = [
  {
    target: "[data-tour='brand']",
    titulo: "Bem-vindo ao seu programa",
    corpo: "Aqui é o seu espaço de IA, guiado passo a passo. Vou te mostrar por onde começar — leva menos de 1 minuto.",
    side: "right",
    align: "start",
  },
  {
    target: "[data-tour='portal-jornada']",
    titulo: "Sua jornada, etapa por etapa",
    corpo: "Este é o seu método de IA. O destaque mostra onde você está agora — é daqui que a gente avança.",
    side: "bottom",
    align: "start",
  },
  {
    target: "[data-tour='nav-copilotos']",
    titulo: "Seus copilotos, sempre à mão",
    corpo: "O Consultor do Programa resume o andamento e sugere a próxima Receita. Ele é proativo — não espera você perguntar.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='nav-automacoes']",
    titulo: "O que roda por você",
    corpo: "Seu stack de IA e as sessões ao vivo agendadas — o que trabalha nos bastidores do seu programa.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='nav-visao']",
    titulo: "Seus resultados, como prova",
    corpo: "ROI do programa, entregáveis prontos para baixar e a biblioteca de materiais. O valor gerado, mês a mês.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='portal-jornada']",
    titulo: "Comece pelo seu passo atual",
    corpo: "Pronto! O melhor primeiro passo é falar com o seu Consultor — ele te diz exatamente o que fazer agora.",
    side: "bottom",
    align: "start",
    route: "/portal/consultor",
    ctaText: "Falar com o Consultor",
  },
];
