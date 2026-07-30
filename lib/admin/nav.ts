/**
 * Arquitetura de informação do admin (U5) — 4 destinos por JORNADA (não por função).
 * As telas são RE-HOSPEDADAS sob os destinos (não movemos arquivos).
 * "Hoje" é o cockpit/landing, acessível pelo topo (logo) e por um atalho — não é um dos 4 destinos.
 * `areaForPath` resolve o destino ativo.
 */
export type AreaKey = "jornadas" | "comercial" | "marketing" | "academy" | "estudio" | "rh" | "config";

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
      { label: "Clientes", href: "/admin/clientes", icon: "team", desc: "Quem são, em que fase estão e quem responde por cada um." },
      { label: "Escopo e entregas", href: "/admin/entregas", icon: "tasks", desc: "O que o contrato promete e o que já foi entregue — com o atraso calculado sozinho." },
      { label: "Programas", href: "/admin/programas", icon: "rocket", desc: "Entrega, fases e ativação por cliente." },
      { label: "Onboarding", href: "/admin/onboarding", icon: "userPlus", desc: "Provisionar e ativar novos clientes." },
      { label: "Consultor", href: "/admin/consultor", icon: "chat", desc: "Conversas do copiloto com o cliente." },
      { label: "ROI / Sucesso", href: "/admin/roi", icon: "trending", desc: "Relatórios de valor e retenção." },
      { label: "Financeiro do cliente", href: "/admin/financeiro", icon: "wallet", desc: "Faturas, recebíveis e a régua de cobrança." },
    ],
  },
  {
    key: "comercial", label: "Comercial", href: "/admin/comercial", icon: "target",
    tagline: "Do sinal ao contrato assinado.",
    primary: { label: "Nova proposta", href: "/admin/propostas" },
    sections: [
      { label: "CRM · pipeline", href: "/admin/crm", icon: "crm", desc: "Negócios por etapa, com arrastar e soltar." },
      { label: "CRM · contas", href: "/admin/crm/contas", icon: "team", desc: "As empresas com quem falamos." },
      { label: "CRM · contatos", href: "/admin/crm/contatos", icon: "userPlus", desc: "As pessoas dentro dessas empresas." },
      { label: "CRM · importar", href: "/admin/crm/importar", icon: "layers", desc: "Trazer contas e contatos de planilha." },
      { label: "Prospecção", href: "/admin/prospeccao", icon: "target", desc: "A base de quem vale abordar, com dossiê e score." },
      { label: "Buscas automáticas", href: "/admin/prospeccao/buscas", icon: "target", desc: "O Apollo traz gente nova todo dia, com o perfil que você definir." },
      { label: "Sinais do LinkedIn", href: "/admin/prospeccao/sinais-linkedin", icon: "trending", desc: "Quem curte e comenta seus posts sobre IA — já está dentro do assunto." },
      { label: "Coleta externa", href: "/admin/prospeccao/coleta-externa", icon: "target", desc: "Raspagem via Apify: atividade em posts de terceiros." },
      { label: "Suas mensagens", href: "/admin/prospeccao/mensagens", icon: "chat", desc: "Quem escreveu para você sobre IA, pela exportação do LinkedIn." },
      { label: "Cadências", href: "/admin/prospeccao/cadencias", icon: "sparkles", desc: "As sequências de toque, passo a passo." },
      { label: "Fila de aprovação", href: "/admin/prospeccao/aprovacao", icon: "shield", desc: "Nada sai sem você ler antes. É aqui que se aprova." },
      { label: "Propostas", href: "/admin/propostas", icon: "pen", desc: "Gerar, enviar e acompanhar a leitura." },
      { label: "Contratos", href: "/admin/contratos", icon: "scroll", desc: "Minutas, assinatura e kickoff." },
      { label: "Jurídico", href: "/admin/juridico", icon: "shield", desc: "Biblioteca de cláusulas versionada e demandas com prazo." },
      { label: "Catálogo de ofertas", href: "/admin/catalogo", icon: "gem", desc: "O que você vende e entrega — alimenta as propostas." },
      { label: "Tarefas", href: "/admin/tarefas", icon: "tasks", desc: "Follow-ups e pendências." },
    ],
  },
  {
    key: "marketing", label: "Marketing", href: "/admin/marketing", icon: "trending",
    tagline: "De onde vêm os leads e o que os faz voltar.",
    primary: { label: "Nova campanha", href: "/admin/marketing" },
    sections: [
      { label: "Campanhas e origem", href: "/admin/marketing", icon: "trending", desc: "Quanto cada esforço trouxe de lead, a que custo, e de onde veio quem virou negócio." },
      { label: "Comunicação (régua)", href: "/admin/comunicacao", icon: "sparkles", desc: "A régua que conduz o cliente — consome ativos aprovados." },
      { label: "Relacionamento", href: "/admin/relacionamento", icon: "chat", desc: "E-mail e WhatsApp da equipe, num lugar só." },
      { label: "Relatórios da inbox", href: "/admin/relacionamento/relatorios", icon: "activity", desc: "Tempo de resposta, volume e SLA." },
      { label: "Configuração da inbox", href: "/admin/relacionamento/config", icon: "settings", desc: "Caixas, rótulos, SLA e templates." },
      { label: "Sinais de prospecção", href: "/admin/sinais", icon: "target", desc: "Gatilhos que somam no score." },
    ],
  },
  {
    key: "academy", label: "Academy", href: "/admin/academy/matriculas", icon: "graduation",
    tagline: "A formação — conteúdo, prova e certificado.",
    primary: { label: "Matrículas", href: "/admin/academy/matriculas" },
    sections: [
      { label: "Matrículas", href: "/admin/academy/matriculas", icon: "creditCard", desc: "Preço do curso, quem tem acesso e liberação gratuita." },
      { label: "Prova e gabarito", href: "/admin/academy/prova", icon: "scroll", desc: "As questões da avaliação final. Correção e certificado são automáticos." },
      { label: "Referências", href: "/admin/academy/referencias", icon: "book", desc: "Prompts, ferramentas, glossário e checklist que o aluno consulta." },
      { label: "Ver como aluno", href: "/academy", icon: "graduation", desc: "Abre o portal do aluno, do jeito que ele vê." },
    ],
  },
  {
    key: "estudio", label: "Estúdio", href: "/admin/entregaveis", icon: "fileText",
    tagline: "A fábrica de entregáveis — de curso a app.",
    primary: { label: "Novo entregável", href: "/admin/entregaveis/novo" },
    sections: [
      { label: "Novo entregável", href: "/admin/entregaveis/novo", icon: "fileText", desc: "Escolha o formato — a IA rascunha." },
      { label: "Entregáveis", href: "/admin/entregaveis", icon: "fileText", desc: "Catálogo multiformato: curso, vídeo, doc, app…" },
      { label: "Estúdio do Método", href: "/admin/estudio", icon: "book", desc: "Receitas, trilhas e sessões." },
      { label: "Método", href: "/admin/metodo", icon: "book", desc: "O método por trás das receitas." },
      { label: "Templates", href: "/admin/biblioteca-templates", icon: "layers", desc: "Blueprints multi-vertical." },
      { label: "Identidade", href: "/admin/entregaveis/identidade", icon: "gem", desc: "A identidade visual dos entregáveis." },
    ],
  },
  {
    key: "rh", label: "RH e Adm.", href: "/admin/rh", icon: "team",
    tagline: "O time e os custos da Salestrack — a empresa por dentro.",
    primary: { label: "Pessoas", href: "/admin/rh" },
    sections: [
      { label: "Pessoas", href: "/admin/rh", icon: "team", desc: "Admissão, cargo, ausências e histórico de remuneração." },
      { label: "Custos e fornecedores", href: "/admin/administracao", icon: "wallet", desc: "Quanto sai por mês, com quem, e o que já não serve." },
    ],
  },
  {
    key: "config", label: "Configurar", href: "/admin/configuracoes", icon: "settings",
    tagline: "Integrações, equipe, operação e governança.",
    primary: { label: "Integrações", href: "/admin/configuracoes/parametros" },
    sections: [
      { label: "Parâmetros & integrações", href: "/admin/configuracoes/parametros", icon: "settings", desc: "Chaves (Apollo, Apify, ASAAS, Gmail, Z-API…), gate de envio, SLA." },
      { label: "Equipe", href: "/admin/configuracoes/equipe", icon: "team", desc: "Quem opera o AI OS do lado Salestrack." },
      { label: "Contratos (modelo)", href: "/admin/configuracoes/contratos", icon: "scroll", desc: "Cláusulas, foro e reajuste da minuta padrão." },
      { label: "Notificações", href: "/admin/configuracoes/notificacoes", icon: "activity", desc: "O que avisa quem, e por qual canal." },
      { label: "Sinais (config)", href: "/admin/configuracoes/sinais", icon: "target", desc: "Peso de cada gatilho no score." },
      { label: "Dados pessoais (LGPD)", href: "/admin/lgpd", icon: "shield", desc: "Pedidos do titular, consentimentos e exclusão de dados." },
      { label: "Auditoria", href: "/admin/configuracoes/auditoria", icon: "shield", desc: "Registro do que aconteceu." },
      { label: "Operações", href: "/admin/operacoes", icon: "activity", desc: "FinOps interno, saúde e alertas." },
      { label: "Agentes de IA", href: "/admin/agentes", icon: "sparkles", desc: "Instruções, modelo e versões de cada agente. Teste antes de publicar." },
      { label: "Custo de IA", href: "/admin/operacoes/ia", icon: "activity", desc: "Quanto cada execução de agente custou, e para qual cliente." },
      { label: "Monetização", href: "/admin/monetizacao", icon: "wallet", desc: "Planos, preços e o que cada um libera." },
      { label: "Plataforma", href: "/admin/plataforma", icon: "settings", desc: "Ajustes de plataforma e limites." },
      { label: "Design system", href: "/admin/design-system", icon: "sparkles", desc: "Linguagem visual Salestrack AI." },
      { label: "Ajuda", href: "/admin/ajuda", icon: "book", desc: "Como usar cada parte do sistema." },
    ],
  },
];

/**
 * Toda tela do admin já traz o próprio `<ContentArea>`, então nenhuma depende mais do
 * LegacyFrame para respiro — ele foi removido. A função fica por compatibilidade e para o
 * teste que trava o contrato: tela nova sem `<ContentArea>` nasce colada na borda.
 */
export function isV5Path(_path: string): boolean {
  return true;
}

/** Mapa rota-legada → destino (para destacar o destino ativo e o breadcrumb). */
const ROUTE_AREA: [string, AreaKey][] = [
  // Jornadas absorve clientes, entregas, programas, onboarding, consultor, ROI e financeiro
  ["/admin/jornadas", "jornadas"], ["/admin/clientes", "jornadas"], ["/admin/entregas", "jornadas"],
  ["/admin/programas", "jornadas"], ["/admin/onboarding", "jornadas"], ["/admin/consultor", "jornadas"],
  ["/admin/roi", "jornadas"], ["/admin/financeiro", "jornadas"],
  // Comercial: do sinal ao contrato
  ["/admin/comercial", "comercial"], ["/admin/crm", "comercial"], ["/admin/prospeccao", "comercial"],
  ["/admin/propostas", "comercial"], ["/admin/contratos", "comercial"], ["/admin/tarefas", "comercial"],
  ["/admin/ofertas", "comercial"], ["/admin/catalogo", "comercial"], ["/admin/juridico", "comercial"],
  // Marketing é destino próprio (antes vivia dentro de Comercial e se perdia lá)
  ["/admin/marketing", "marketing"], ["/admin/comunicacao", "marketing"],
  ["/admin/relacionamento", "marketing"], ["/admin/sinais", "marketing"],
  // Academy também: estava enterrada no Estúdio e ninguém achava
  ["/admin/academy", "academy"],
  // Estúdio: a fábrica de entregáveis
  ["/admin/entregaveis", "estudio"], ["/admin/estudio-area", "estudio"], ["/admin/estudio", "estudio"],
  ["/admin/biblioteca-templates", "estudio"], ["/admin/metodo", "estudio"],
  // Configurar
  // RH é destino próprio: o dado vive em outro banco e o acesso é concedido lá.
  ["/admin/rh", "rh"], ["/admin/administracao", "rh"],
  ["/admin/configuracoes", "config"], ["/admin/lgpd", "config"], ["/admin/agentes", "config"], ["/admin/operacoes", "config"],
  ["/admin/design-system", "config"], ["/admin/plataforma", "config"], ["/admin/monetizacao", "config"],
  ["/admin/ajuda", "config"],
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
