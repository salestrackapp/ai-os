/**
 * Navegação do portal do cliente (U4) — 3 destinos: Minha Jornada · Entregas · Conta.
 * As telas avançadas (Playbook, Sessões, ROI, Stack, Governança, Consultor…) continuam existindo e
 * são reveladas conforme a etapa na home "Minha Jornada" (revelação progressiva); aqui só a espinha.
 */
export type PortalAreaKey = "jornada" | "entregas" | "conta";

export type PortalSub = { label: string; href: string; icon: string; desc: string };
export type PortalArea = {
  key: PortalAreaKey; label: string; href: string; icon: string; tagline: string;
  primary?: { label: string; href: string };
  sections: PortalSub[];
};

export const PORTAL_AREAS: PortalArea[] = [
  { key: "jornada", label: "Minha Jornada", href: "/portal", icon: "rocket", tagline: "Onde você está e o próximo passo.", sections: [] },
  { key: "entregas", label: "Entregas", href: "/portal/entregaveis", icon: "fileText", tagline: "Cursos, vídeos, documentos — no seu ritmo.", sections: [] },
  {
    key: "conta", label: "Conta", href: "/portal/conta", icon: "settings",
    tagline: "Dados, financeiro e acesso.",
    sections: [
      { label: "Equipe", href: "/portal/equipe", icon: "team", desc: "Quem acessa o portal do seu lado." },
      { label: "Financeiro", href: "/portal/financeiro", icon: "creditCard", desc: "Faturas e situação da assinatura." },
      { label: "Governança", href: "/portal/governanca", icon: "shield", desc: "Política e segurança do seu stack de IA." },
      { label: "Turma", href: "/portal/academy/turma", icon: "graduation", desc: "Como sua equipe está na formação em agentes de IA." },
    ],
  },
];

/**
 * Todas as telas do portal já trazem o próprio `<ContentArea>`, então nenhuma depende mais do
 * frame legado para respiro — ele foi removido. A função fica por compatibilidade e para o
 * teste que trava o contrato: se alguém criar uma tela nova sem `<ContentArea>`, ela nasce
 * colada na borda, e é isso que este comentário existe para avisar.
 */
export function isV5PortalPath(_path: string): boolean {
  return true;
}

const ROUTE_AREA: [string, PortalAreaKey][] = [
  ["/portal/entregaveis", "entregas"],
  ["/portal/conta", "conta"], ["/portal/equipe", "conta"], ["/portal/financeiro", "conta"], ["/portal/governanca", "conta"], ["/portal/config", "conta"],
  // avançadas reveladas na home ficam sob "jornada" para o destaque do menu
  ["/portal/roi", "jornada"], ["/portal/biblioteca", "jornada"], ["/portal/consultor", "jornada"], ["/portal/playbook", "jornada"],
  ["/portal/stack", "jornada"], ["/portal/sessoes", "jornada"], ["/portal/visao", "jornada"], ["/portal/copilotos", "jornada"], ["/portal/automacoes", "jornada"],
];
export function areaForPortalPath(path: string): PortalAreaKey {
  if (path === "/portal") return "jornada";
  const hit = ROUTE_AREA.filter(([r]) => path === r || path.startsWith(r + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? "jornada";
}
