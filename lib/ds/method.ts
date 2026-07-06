/**
 * AI Operating Method™ — dados das 5 etapas (módulo NEUTRO, sem "use client").
 * Fica aqui para poder ser importado tanto por Server Components (ex.: Jornada do portal)
 * quanto pelo componente client CycleSteps. Importar valores de um módulo "use client"
 * num Server Component retorna referências vazias — por isso a fonte fica separada.
 */
export type CycleStep = { key: string; title: string; objective: string; state?: string };

export const AI_METHOD: CycleStep[] = [
  { key: "diagnosticar", title: "Diagnosticar", objective: "Mapear maturidade, dores e stack de IA atual." },
  { key: "estruturar", title: "Estruturar", objective: "Desenhar o método, frentes e governança." },
  { key: "implementar", title: "Implementar", objective: "Colocar agentes e automações prioritárias no ar." },
  { key: "capacitar", title: "Capacitar", objective: "Treinar o time via Playbook e sessões ao vivo." },
  { key: "evoluir", title: "Evoluir", objective: "Medir ROI, ajustar e reiniciar o ciclo." },
];
