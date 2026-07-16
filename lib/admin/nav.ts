/**
 * Arquitetura de informação do admin — 6 áreas (Salestrack AI v2).
 * As telas legadas (M1–M17) são RE-HOSPEDADAS sob as áreas: cada índice de área lista
 * suas subseções apontando para as rotas existentes (não movemos os arquivos — escolha segura).
 * `areaForPath` resolve a área ativa; `isV5Path` distingue páginas v5 (claras) das legadas (frame escuro).
 */
export type AreaKey = "jornadas" | "hoje" | "clientes" | "comercial" | "relacionamento" | "estudio" | "metodo" | "plataforma";

export type SubSection = { label: string; href: string; icon: string; desc: string };

export type Area = {
  key: AreaKey; label: string; href: string; icon: string; tagline: string;
  primary?: { label: string; href: string };
  sections: SubSection[];
};

export const AREAS: Area[] = [
  {
    key: "jornadas", label: "Jornadas", href: "/admin/jornadas", icon: "rocket",
    tagline: "As transformações em andamento — do cadastro à entrega.",
    primary: { label: "Nova jornada", href: "/admin/jornadas/nova" },
    sections: [
      { label: "Painel de jornadas", href: "/admin/jornadas", icon: "rocket", desc: "Todas em paralelo, por etapa, com a próxima ação." },
      { label: "Nova jornada", href: "/admin/jornadas/nova", icon: "userPlus", desc: "Cadastro em 1 tela — já sai o link do diagnóstico." },
    ],
  },
  {
    key: "hoje", label: "Hoje", href: "/admin/hoje", icon: "dashboard",
    tagline: "O que precisa da sua atenção agora.", sections: [],
  },
  {
    key: "clientes", label: "Clientes", href: "/admin/clientes", icon: "team",
    tagline: "A entrega e a saúde de cada cliente, em um lugar.",
    primary: { label: "Novo cliente", href: "/admin/onboarding/novo" },
    sections: [
      { label: "Programas", href: "/admin/programas", icon: "rocket", desc: "Entrega, fases e ativação por cliente." },
      { label: "Onboarding", href: "/admin/onboarding", icon: "userPlus", desc: "Provisionar e ativar novos clientes." },
      { label: "Consultor", href: "/admin/consultor", icon: "chat", desc: "Conversas do copiloto com o cliente." },
      { label: "ROI / Sucesso", href: "/admin/roi", icon: "trending", desc: "Relatórios de valor e retenção." },
    ],
  },
  {
    key: "comercial", label: "Comercial", href: "/admin/comercial", icon: "target",
    tagline: "Do sinal ao cliente — o funil inteiro.",
    primary: { label: "Nova proposta", href: "/admin/propostas" },
    sections: [
      { label: "CRM", href: "/admin/crm", icon: "crm", desc: "Pipeline, contas e contatos." },
      { label: "Prospecção", href: "/admin/prospeccao", icon: "target", desc: "Sinais, cadências e abordagem." },
      { label: "Propostas", href: "/admin/propostas", icon: "pen", desc: "Gerar, enviar e acompanhar." },
      { label: "Contratos", href: "/admin/contratos", icon: "scroll", desc: "Minutas, assinatura e kickoff." },
      { label: "Tarefas", href: "/admin/tarefas", icon: "tasks", desc: "Follow-ups e pendências." },
      { label: "Catálogo de ofertas", href: "/admin/catalogo", icon: "gem", desc: "O que você vende e entrega — alimenta as propostas (Diagnose, Sprint, engajamento, Mentoria, workshops)." },
      { label: "Sinais de prospecção", href: "/admin/sinais", icon: "target", desc: "Gatilhos que somam no score — criar, editar, duplicar e excluir." },
    ],
  },
  {
    key: "relacionamento", label: "Relacionamento", href: "/admin/relacionamento", icon: "chat",
    tagline: "A caixa de e-mail e as mensagens de WhatsApp da equipe, em um lugar.",
    sections: [
      { label: "Caixa de entrada", href: "/admin/relacionamento", icon: "chat", desc: "E-mails da Salestrack — ler, atribuir, responder." },
      { label: "Mensagens", href: "/admin/relacionamento", icon: "chat", desc: "WhatsApp — conversas 2 vias com opt-in." },
      { label: "Templates & regras", href: "/admin/relacionamento/config", icon: "layers", desc: "Respostas reutilizáveis e roteamento automático." },
      { label: "Relatórios", href: "/admin/relacionamento/relatorios", icon: "trending", desc: "Volume, SLA, tempo de resposta e carga por membro." },
    ],
  },
  {
    key: "estudio", label: "Estúdio", href: "/admin/estudio-area", icon: "fileText",
    tagline: "A fábrica de entregáveis executivos.",
    primary: { label: "Novo entregável", href: "/admin/entregaveis" },
    sections: [
      { label: "Estúdio de Entregáveis", href: "/admin/entregaveis", icon: "fileText", desc: "Propostas, ROI, dossiês e apresentações." },
      { label: "Comunicação (régua)", href: "/admin/comunicacao", icon: "sparkles", desc: "A régua que conduz o cliente ao longo do ciclo — consome ativos aprovados." },
    ],
  },
  {
    key: "metodo", label: "Método", href: "/admin/metodo", icon: "book",
    tagline: "O AI Operating Method — catálogo, templates e trilhas.",
    primary: { label: "Estúdio do Método", href: "/admin/estudio" },
    sections: [
      { label: "Estúdio do Método", href: "/admin/estudio", icon: "book", desc: "Receitas, trilhas e sessões." },
      { label: "Templates", href: "/admin/biblioteca-templates", icon: "layers", desc: "Blueprints multi-vertical." },
      // "Catálogo" consolidado com "Ofertas" → agora vive em Comercial como "Catálogo de ofertas" (mesma fonte catalog_items).
    ],
  },
  {
    key: "plataforma", label: "Plataforma", href: "/admin/plataforma", icon: "settings",
    tagline: "Configuração, cobrança, operação e governança.",
    primary: { label: "Configurações", href: "/admin/configuracoes" },
    sections: [
      { label: "Financeiro", href: "/admin/financeiro", icon: "wallet", desc: "Faturas e recebíveis das ofertas vendidas." },
      // "Monetização" (planos/mensalidade de plataforma) arquivada — modelo atual sem assinatura de plataforma.
      { label: "Operações", href: "/admin/operacoes", icon: "activity", desc: "FinOps interno, saúde e alertas." },
      { label: "Configurações", href: "/admin/configuracoes", icon: "settings", desc: "Parâmetros, integrações e segurança." },
      { label: "Design system", href: "/admin/design-system", icon: "sparkles", desc: "Linguagem visual Salestrack AI v2." },
    ],
  },
];

/** Rotas cujo índice é v5 (renderiza claro). Todo o resto (legado) usa frame escuro. */
const V5_EXTRA = ["/admin/jornadas", "/admin/jornadas/nova", "/admin/sinais", "/admin/ofertas", "/admin/programas", "/admin/programas/novo", "/admin/entregaveis", "/admin/comunicacao", "/admin/ajuda"];   // telas migradas para o design v5
const V5_INDEX = new Set<string>(AREAS.map((a) => a.href).concat("/admin", "/admin/hoje", ...V5_EXTRA));
export function isV5Path(path: string): boolean {
  if (V5_INDEX.has(path)) return true;
  if (/^\/admin\/programas\/[^/]+\/editar$/.test(path)) return true;   // editor v5 do programa
  if (/^\/admin\/clientes\/[^/]+$/.test(path)) return true;            // ficha 360 do cliente
  if (/^\/admin\/clientes\/[^/]+\/caixa$/.test(path)) return true;     // caixa de e-mail do cliente (Gmail)
  if (/^\/admin\/clientes\/[^/]+\/diagnostico$/.test(path)) return true; // formulário de diagnóstico do cliente
  if (/^\/admin\/relacionamento\/[^/]+$/.test(path)) return true;      // leitura da thread (Relacionamento E1)
  if (/^\/admin\/entregaveis\/[^/]+$/.test(path)) return true;         // detalhe do entregável (Estúdio v5)
  return false;
}

/** Mapa rota-legada → área (para destacar a área ativa e o breadcrumb). */
const ROUTE_AREA: [string, AreaKey][] = [
  ["/admin/programas", "clientes"], ["/admin/onboarding", "clientes"], ["/admin/consultor", "clientes"], ["/admin/roi", "clientes"],
  ["/admin/crm", "comercial"], ["/admin/prospeccao", "comercial"], ["/admin/propostas", "comercial"], ["/admin/contratos", "comercial"], ["/admin/tarefas", "comercial"], ["/admin/sinais", "comercial"], ["/admin/ofertas", "comercial"], ["/admin/catalogo", "comercial"],
  ["/admin/relacionamento", "relacionamento"],
  ["/admin/entregaveis", "estudio"], ["/admin/estudio-area", "estudio"], ["/admin/comunicacao", "estudio"],
  ["/admin/estudio", "metodo"], ["/admin/biblioteca-templates", "metodo"],
  ["/admin/financeiro", "plataforma"], ["/admin/monetizacao", "plataforma"], ["/admin/operacoes", "plataforma"], ["/admin/configuracoes", "plataforma"], ["/admin/design-system", "plataforma"],
  ["/admin/jornadas", "jornadas"],
  ["/admin/hoje", "hoje"], ["/admin/ajuda", "hoje"], ["/admin/clientes", "clientes"], ["/admin/comercial", "comercial"], ["/admin/metodo", "metodo"], ["/admin/plataforma", "plataforma"],
];
export function areaForPath(path: string): AreaKey {
  if (path === "/admin") return "hoje";
  // caminho mais específico primeiro
  const hit = ROUTE_AREA.filter(([r]) => path === r || path.startsWith(r + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? "hoje";
}

/** Rótulo curto da subseção legada atual (breadcrumb). */
export function sectionLabelForPath(path: string): string | null {
  for (const a of AREAS) for (const s of a.sections) if (path === s.href || path.startsWith(s.href + "/")) return s.label;
  return null;
}
