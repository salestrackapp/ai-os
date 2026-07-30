import type { TourStep } from "./types";

/**
 * Tour do ADMIN — DEMONSTRATIVO (não executa nada, não navega para fora).
 * Fica no cockpit Hoje e apresenta o mapa: Hoje → Jornadas → Comercial → Estúdio → Configurar.
 * Cada passo explica o que existe ali e como usar. Ao concluir, o operador segue no Hoje.
 * Alvos reais via data-tour: brand + admin-hoje (no /admin/hoje) e itens da sidebar (sempre presentes).
 */
export const ADMIN_STEPS: TourStep[] = [
  {
    target: "[data-tour='brand']",
    titulo: "Bem-vindo ao AI OS",
    corpo: "Em 1 minuto eu mostro o mapa do seu centro de operações — para onde ir e o que cada área faz. Nada é criado ou alterado durante o tour.",
    side: "right",
    align: "start",
  },
  {
    target: "[data-tour='admin-hoje']",
    titulo: "Hoje — seu ponto de partida",
    corpo: "O cockpit reúne o que precisa de você agora: alertas, o funil em movimento e as ações do dia. Sempre que abrir o AI OS, comece por aqui.",
    side: "bottom",
    align: "start",
  },
  {
    target: "[data-tour='nav-jornadas']",
    titulo: "Jornadas — as transformações em paralelo",
    corpo: "Cada cliente é uma jornada, do cadastro à entrega, com a etapa e a próxima ação sempre à vista. É aqui que você cria uma nova jornada e acompanha as existentes, uma ao lado da outra.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='nav-comercial']",
    titulo: "Comercial — do sinal ao fechamento",
    corpo: "Prospecção, propostas geradas a partir do catálogo de ofertas e contratos. Todo o caminho até o cliente virar uma jornada vive nesta área.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='nav-estudio']",
    titulo: "Estúdio — a fábrica de entregas",
    corpo: "Escolhe o formato (curso, vídeo, documento, app), a IA rascunha, você aprova e o sistema publica — sempre na identidade Salestrack AI. O que é aprovado aqui abastece a jornada do cliente.",
    side: "right",
    align: "center",
  },
  {
    target: "[data-tour='admin-hoje']",
    titulo: "Pronto — o mapa é esse",
    corpo: "Hoje para operar, Jornadas para conduzir os clientes, Comercial para captar e Estúdio para produzir. Quando quiser rever, é só clicar em “Fazer o tour” no menu. Bom trabalho!",
    side: "bottom",
    align: "start",
  },
];
