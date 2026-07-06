/** Tour guiado (R5.4) — tipo de passo, ancorado a um elemento real via data-tour. */
export type TourStep = {
  /** Seletor CSS do alvo real (ex.: "[data-tour='admin-hoje']"). */
  target: string;
  titulo: string;
  corpo: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  /** Passo interativo: se definido, o botão inicia a AÇÃO REAL (navega) e encerra o tour. */
  route?: string;
  /** Rótulo do botão no passo interativo (default "Próximo"). */
  ctaText?: string;
};

export type Surface = "admin" | "portal";
