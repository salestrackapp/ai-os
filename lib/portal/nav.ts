/**
 * Navegação do portal do cliente — kit "ai-operating-system" (Salestrack AI v2).
 * 5 áreas: Jornada principal · Visão geral · Copilotos · Automações · Configurações.
 * Re-hospeda as telas existentes do portal sob as áreas (aditivo; não movemos arquivos).
 */
export type PortalAreaKey = "jornada" | "visao" | "copilotos" | "automacoes" | "config";

export type PortalSub = { label: string; href: string; icon: string; desc: string };
export type PortalArea = {
  key: PortalAreaKey; label: string; href: string; icon: string; tagline: string;
  primary?: { label: string; href: string };
  sections: PortalSub[];
};

export const PORTAL_AREAS: PortalArea[] = [
  { key: "jornada", label: "Jornada principal", href: "/portal", icon: "rocket", tagline: "Seu método de IA, etapa por etapa.", sections: [] },
  {
    key: "visao", label: "Visão geral", href: "/portal/visao", icon: "chart",
    tagline: "Os resultados e materiais do seu programa.",
    sections: [
      { label: "ROI do programa", href: "/portal/roi", icon: "trending", desc: "O valor gerado, mês a mês." },
      { label: "Entregáveis", href: "/portal/entregaveis", icon: "fileText", desc: "Documentos executivos prontos para baixar." },
      { label: "Biblioteca", href: "/portal/biblioteca", icon: "folder", desc: "Materiais e recursos do programa." },
    ],
  },
  {
    key: "copilotos", label: "Copilotos", href: "/portal/copilotos", icon: "sparkles",
    tagline: "Seus assistentes de IA, sempre à mão.",
    primary: { label: "Falar com o Consultor", href: "/portal/consultor" },
    sections: [
      { label: "Consultor do Programa", href: "/portal/consultor", icon: "chat", desc: "Resume o andamento e guia pelas Receitas." },
      { label: "Playbook", href: "/portal/playbook", icon: "graduation", desc: "Receitas práticas para aplicar com IA." },
    ],
  },
  {
    key: "automacoes", label: "Automações", href: "/portal/automacoes", icon: "activity",
    tagline: "O que roda por você — stack e sessões ao vivo.",
    sections: [
      { label: "Meu Stack de IA", href: "/portal/stack", icon: "layers", desc: "As ferramentas e agentes do seu programa." },
      { label: "Sessões ao Vivo", href: "/portal/sessoes", icon: "calendar", desc: "Mentorias e workshops agendados." },
    ],
  },
  {
    key: "config", label: "Configurações", href: "/portal/config", icon: "settings",
    tagline: "Equipe, financeiro e governança.",
    sections: [
      { label: "Equipe", href: "/portal/equipe", icon: "team", desc: "Quem acessa o portal do seu lado." },
      { label: "Financeiro", href: "/portal/financeiro", icon: "creditCard", desc: "Faturas e situação da assinatura." },
      { label: "Governança", href: "/portal/governanca", icon: "shield", desc: "Política e segurança do seu stack de IA." },
    ],
  },
];

const V5_INDEX = new Set<string>(PORTAL_AREAS.map((a) => a.href));
export function isV5PortalPath(path: string): boolean {
  return V5_INDEX.has(path);
}

const ROUTE_AREA: [string, PortalAreaKey][] = [
  ["/portal/roi", "visao"], ["/portal/entregaveis", "visao"], ["/portal/biblioteca", "visao"],
  ["/portal/consultor", "copilotos"], ["/portal/playbook", "copilotos"],
  ["/portal/stack", "automacoes"], ["/portal/sessoes", "automacoes"],
  ["/portal/equipe", "config"], ["/portal/financeiro", "config"], ["/portal/governanca", "config"],
  ["/portal/visao", "visao"], ["/portal/copilotos", "copilotos"], ["/portal/automacoes", "automacoes"], ["/portal/config", "config"],
];
export function areaForPortalPath(path: string): PortalAreaKey {
  if (path === "/portal") return "jornada";
  const hit = ROUTE_AREA.filter(([r]) => path === r || path.startsWith(r + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? "jornada";
}
