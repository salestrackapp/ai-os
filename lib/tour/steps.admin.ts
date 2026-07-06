import type { TourStep } from "./types";

/**
 * Caminho de ouro do ADMIN (operador Salestrack): boas-vindas → cockpit Hoje →
 * cadastrar 1º cliente (passo interativo, inicia o cadastro real) → propostas
 * (catálogo de ofertas) → Estúdio (gerar → aprovar) → Comunicação (a régua conduz).
 * Tom copiloto, sentence case, PT. Alvos reais via data-tour (existem em /admin/hoje).
 */
export const ADMIN_STEPS: TourStep[] = [
  {
    target: "[data-tour='brand']",
    titulo: "Bem-vindo ao AI OS",
    corpo: "Este é o seu centro de operações. Em 1 minuto eu mostro o caminho para você começar a operar — não só olhar.",
    side: "right",
    align: "start",
  },
  {
    target: "[data-tour='admin-hoje']",
    titulo: "Comece pelo Hoje",
    corpo: "O cockpit reúne o que precisa da sua atenção agora: alertas, o funil em movimento e as ações do dia.",
    side: "bottom",
    align: "start",
  },
  {
    target: "[data-tour='nav-clientes']",
    titulo: "Seus clientes vivem aqui",
    corpo: "Programas, onboarding, consultor e ROI de cada cliente em um lugar. Vamos cadastrar o primeiro?",
    side: "right",
    align: "center",
    route: "/admin/onboarding/novo",
    ctaText: "Cadastrar meu primeiro cliente",
  },
  {
    target: "[data-tour='nav-comercial']",
    titulo: "Do sinal ao fechamento",
    corpo: "No Comercial você prospecta, gera propostas a partir do catálogo de ofertas e fecha contratos.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='nav-estudio']",
    titulo: "O Estúdio produz as entregas",
    corpo: "A IA rascunha o material, você aprova e o sistema publica — sempre na identidade Salestrack AI.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='nav-estudio']",
    titulo: "A Comunicação conduz o cliente",
    corpo: "A régua consome os materiais aprovados e conduz o cliente pelo ciclo — com você aprovando antes de sair. Bom trabalho: sua próxima ação é cadastrar um cliente.",
    side: "right",
    align: "center",
  },
];
