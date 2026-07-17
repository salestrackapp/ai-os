/**
 * Arquitetura de informação do admin (U5) — 4 destinos por JORNADA (não por função).
 * As telas legadas são RE-HOSPEDADAS sob os destinos (não movemos arquivos; `isV5Path` intacto).
 * "Hoje" é o cockpit/landing, acessível pelo topo (logo) e por um atalho — não é um dos 4 destinos.
 * `areaForPath` resolve o destino ativo; `isV5Path` distingue páginas v5 (claras) das legadas (frame escuro).
 */
export type AreaKey = "jornadas" | "comercial" | "estudio" | "config";

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
      { label: "Relacionamento", href: "/admin/relacionamento", icon: "chat", desc: "E-mail + WhatsApp da equipe, ligados à timeline." },
      { label: "Programas", href: "/admin/programas", icon: "rocket", desc: "Entrega, fases e ativação por cliente." },
      { label: "Onboarding", href: "/admin/onboarding", icon: "userPlus", desc: "Provisionar e ativar novos clientes." },
      { label: "Consultor", href: "/admin/consultor", icon: "chat", desc: "Conversas do copiloto com o cliente." },
      { label: "ROI / Sucesso", href: "/admin/roi", icon: "trending", desc: "Relatórios de valor e retenção." },
      { label: "Financeiro do cliente", href: "/admin/financeiro", icon: "wallet", desc: "Faturas e recebíveis das ofertas vendidas." },
    ],
  },
  {
    key: "comercial", label: "Comercial", href: "/admin/comercial", icon: "target",
    tagline: "Do sinal ao cliente — captação e fechamento.",
    primary: { label: "Nova proposta", href: "/admin/propostas" },
    sections: [
      { label: "CRM", href: "/admin/crm", icon: "crm", desc: "Pipeline, contas e contatos." },
      { label: "Prospecção", href: "/admin/prospeccao", icon: "target", desc: "Sinais, cadências e abordagem." },
      { label: "Propostas", href: "/admin/propostas", icon: "pen", desc: "Gerar, enviar e acompanhar." },
      { label: "Contratos", href: "/admin/contratos", icon: "scroll", desc: "Minutas, assinatura e kickoff." },
      { label: "Tarefas", href: "/admin/tarefas", icon: "tasks", desc: "Follow-ups e pendências." },
      { label: "Catálogo de ofertas", href: "/admin/catalogo", icon: "gem", desc: "O que você vende e entrega — alimenta as propostas." },
      { label: "Sinais de prospecção", href: "/admin/sinais", icon: "target", desc: "Gatilhos que somam no score." },
    ],
  },
  {
    key: "estudio", label: "Estúdio", href: "/admin/entregaveis", icon: "fileText",
    tagline: "A fábrica de entregáveis — de curso a app.",
    primary: { label: "Novo entregável", href: "/admin/entregaveis/novo" },
    sections: [
      { label: "Novo entregável", href: "/admin/entregaveis/novo", icon: "fileText", desc: "Escolha o formato — a IA rascunha." },
      { label: "Entregáveis", href: "/admin/entregaveis", icon: "fileText", desc: "Catálogo multiformato: curso, vídeo, doc, app…" },
      { label: "Comunicação (régua)", href: "/admin/comunicacao", icon: "sparkles", desc: "A régua que conduz o cliente — consome ativos aprovados." },
      { label: "Estúdio do Método", href: "/admin/estudio", icon: "book", desc: "Receitas, trilhas e sessões." },
      { label: "Templates", href: "/admin/biblioteca-templates", icon: "layers", desc: "Blueprints multi-vertical." },
      { label: "Identidade", href: "/admin/entregaveis/identidade", icon: "gem", desc: "A identidade visual dos entregáveis." },
    ],
  },
  {
    key: "config", label: "Configurar", href: "/admin/configuracoes", icon: "settings",
    tagline: "Integrações, equipe, operação e governança.",
    primary: { label: "Integrações", href: "/admin/configuracoes/parametros?cat=integracoes" },
    sections: [
      { label: "Parâmetros & integrações", href: "/admin/configuracoes/parametros", icon: "settings", desc: "Chaves (Gmail, Z-API, ASAAS…), gate de envio, SLA." },
      { label: "Equipe", href: "/admin/configuracoes/equipe", icon: "team", desc: "Quem opera o AI OS do lado Salestrack." },
      { label: "Auditoria", href: "/admin/configuracoes/auditoria", icon: "shield", desc: "Registro do que aconteceu." },
      { label: "Operações", href: "/admin/operacoes", icon: "activity", desc: "FinOps interno, saúde e alertas." },
      { label: "Design system", href: "/admin/design-system", icon: "sparkles", desc: "Linguagem visual Salestrack AI v2." },
    ],
  },
];

/** Rotas cujo índice é v5 (renderiza claro). Todo o resto (legado) usa frame escuro. */
const V5_EXTRA = [
  "/admin/jornadas", "/admin/jornadas/nova", "/admin/clientes", "/admin/relacionamento", "/admin/relacionamento/config", "/admin/relacionamento/relatorios",
  "/admin/sinais", "/admin/ofertas", "/admin/catalogo", "/admin/programas", "/admin/programas/novo", "/admin/entregaveis", "/admin/entregaveis/novo", "/admin/comunicacao", "/admin/ajuda",
  // ex-índices de área (absorvidos) que ainda existem — mantêm o frame claro:
  "/admin/estudio-area", "/admin/metodo", "/admin/plataforma",
];
const V5_INDEX = new Set<string>(AREAS.map((a) => a.href).concat("/admin", "/admin/hoje", ...V5_EXTRA));
export function isV5Path(path: string): boolean {
  if (V5_INDEX.has(path)) return true;
  if (/^\/admin\/programas\/[^/]+\/editar$/.test(path)) return true;   // editor v5 do programa
  if (/^\/admin\/clientes\/[^/]+$/.test(path)) return true;            // ficha-jornada do cliente
  if (/^\/admin\/clientes\/[^/]+\/caixa$/.test(path)) return true;     // caixa de e-mail do cliente (Gmail)
  if (/^\/admin\/clientes\/[^/]+\/diagnostico$/.test(path)) return true; // formulário de diagnóstico do cliente
  if (/^\/admin\/relacionamento\/[^/]+$/.test(path)) return true;      // leitura da thread (Relacionamento E1)
  if (/^\/admin\/entregaveis\/[^/]+$/.test(path)) return true;         // detalhe do entregável (Estúdio v5)
  return false;
}

/** Mapa rota-legada → destino (para destacar o destino ativo e o breadcrumb). */
const ROUTE_AREA: [string, AreaKey][] = [
  // Jornadas absorve clientes/relacionamento/programas/onboarding/consultor/roi/financeiro
  ["/admin/jornadas", "jornadas"], ["/admin/clientes", "jornadas"], ["/admin/relacionamento", "jornadas"],
  ["/admin/programas", "jornadas"], ["/admin/onboarding", "jornadas"], ["/admin/consultor", "jornadas"], ["/admin/roi", "jornadas"], ["/admin/financeiro", "jornadas"],
  // Comercial
  ["/admin/comercial", "comercial"], ["/admin/crm", "comercial"], ["/admin/prospeccao", "comercial"], ["/admin/propostas", "comercial"], ["/admin/contratos", "comercial"], ["/admin/tarefas", "comercial"], ["/admin/sinais", "comercial"], ["/admin/ofertas", "comercial"], ["/admin/catalogo", "comercial"],
  // Estúdio (entregáveis + método + comunicação)
  ["/admin/entregaveis", "estudio"], ["/admin/estudio-area", "estudio"], ["/admin/comunicacao", "estudio"], ["/admin/estudio", "estudio"], ["/admin/biblioteca-templates", "estudio"], ["/admin/metodo", "estudio"],
  // Configurar
  ["/admin/configuracoes", "config"], ["/admin/operacoes", "config"], ["/admin/design-system", "config"], ["/admin/plataforma", "config"], ["/admin/monetizacao", "config"],
];
export function areaForPath(path: string): AreaKey {
  if (path === "/admin" || path === "/admin/hoje" || path === "/admin/ajuda") return "jornadas";
  const hit = ROUTE_AREA.filter(([r]) => path === r || path.startsWith(r + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? "jornadas";
}

/** Rótulo curto da subseção legada atual (breadcrumb). */
export function sectionLabelForPath(path: string): string | null {
  for (const a of AREAS) for (const s of a.sections) if (path === s.href || path.startsWith(s.href + "/")) return s.label;
  return null;
}
