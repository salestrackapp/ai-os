import type { TourStep } from "./types";

/**
 * Tour do PORTAL (cliente) — DEMONSTRATIVO (não executa nada, não navega para fora).
 * Fica na home "Minha Jornada" e apresenta os 3 destinos: Jornada · Entregas · Conta.
 * Tom copiloto que acalma e conduz. Ao concluir, o cliente segue na sua jornada.
 * Alvos reais: brand + portal-jornada (na home) e itens da sidebar (sempre presentes).
 */
export const PORTAL_STEPS: TourStep[] = [
  {
    target: "[data-tour='brand']",
    titulo: "Bem-vindo ao seu programa",
    corpo: "Aqui é o seu espaço de IA, guiado passo a passo. Vou te mostrar por onde começar — leva menos de 1 minuto e nada é alterado durante o tour.",
    side: "right",
    align: "start",
  },
  {
    target: "[data-tour='portal-jornada']",
    titulo: "Sua jornada, etapa por etapa",
    corpo: "Este é o seu método de IA. O destaque mostra onde você está agora e qual é o próximo passo — é daqui que a gente avança, sem pressa.",
    side: "bottom",
    align: "start",
  },
  {
    target: "[data-tour='nav-entregas']",
    titulo: "Entregas — o que é seu",
    corpo: "Cursos, vídeos, documentos e aplicações prontos para acessar no seu ritmo. Tudo o que produzimos para o seu programa fica reunido aqui.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='nav-conta']",
    titulo: "Conta — sem burocracia",
    corpo: "Seus dados, o financeiro do programa e quem do seu time tem acesso ao portal. Simples e no seu controle.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='portal-jornada']",
    titulo: "Pronto para começar",
    corpo: "É só isso: sua jornada mostra o próximo passo, Entregas guarda o que é seu e Conta cuida do resto. Quando quiser rever, clique em “Fazer o tour” no menu.",
    side: "bottom",
    align: "start",
  },
];
