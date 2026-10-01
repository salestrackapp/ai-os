export type Item = {
  id: string;
  title: string;
  area: "vendas" | "evolucao";
  priority: number;
  agent: string;
  minutes: number;
  href: string;
  trigger: string;
  steps: string[];
  proof: string;
};
export type Progress = {
  status: "pendente" | "em_andamento" | "concluido" | "bloqueado";
  evidence: string;
  updatedAt: string;
  actor: string;
};
export type DealInput = {
  id: string;
  title: string;
  stage: string;
  score: number | null;
  last_activity_at: string | null;
};
export type TaskInput = { id: string; title: string; due_date: string | null };
export const POSITIONING =
  "Ajudamos sua empresa a gerar mais resultados com transformação digital e IA. Partimos de uma prioridade empresarial e construímos o escopo com a equipe: processos, dados, tecnologia, implementação guiada, mentoria e capacitação. Atuação em diferentes áreas; sem produto pronto, prazo fixo ou ganho prometido.";
export function brasiliaDay(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day + "T12:00:00Z")) &&
    new Date(day + "T12:00:00Z").toISOString().slice(0, 10) === day
  );
}
export const BACKLOG: Item[] = [
  {
    id: "banco",
    title: "Restaurar e validar o banco ai-os",
    area: "evolucao",
    priority: 100,
    agent: "Operações",
    minutes: 15,
    href: "https://supabase.com/dashboard/org/aphoewxtswlllbgzwtnk/billing",
    trigger: "Antes de usar o CRM ou ativar qualquer rotina.",
    steps: [
      "Verificar status e eventuais pendências de faturamento na organização Supabase.",
      "Restaurar maazgvwbcszcsjsvqnnf e confirmar status ativo.",
      "Conferir tabelas, RLS, backups e usuário administrador; executar testes de isolamento.",
    ],
    proof:
      "Banco ativo, leitura e escrita autenticadas verificadas, acesso anônimo e de outra organização negado.",
  },
  {
    id: "publicacao",
    title: "Publicar a versão revisada na Vercel",
    area: "evolucao",
    priority: 95,
    agent: "Operações",
    minutes: 20,
    href: "https://vercel.com/salestrack-ai/ai-os",
    trigger: "Depois de restaurar o banco e validar o código em preview.",
    steps: [
      "Vincular o checkout ao projeto ai-os existente; conferir variáveis sem revelar valores.",
      "Gerar preview da branch revisada e testar login, CRM, tarefa, proposta e backup.",
      "Promover a versão validada. Renomear o projeto para salestrack-os preservando os domínios até conferir redirecionamentos.",
    ],
    proof:
      "URL de produção e commit publicados; testes do fluxo principal aprovados.",
  },
  {
    id: "ia",
    title: "Habilitar e medir os agentes de IA",
    area: "evolucao",
    priority: 90,
    agent: "Orquestrador",
    minutes: 20,
    href: "/admin/configuracoes/parametros",
    trigger: "Antes de pedir geração ou análise por IA.",
    steps: [
      "Configurar a API Anthropic da Salestrack e modelo disponível na conta. O plugin no chat não substitui essa credencial.",
      "Testar um briefing com dados fictícios e conferir que a ausência de dados aparece como pendência.",
      "Definir limite de gasto, responsável e revisar a primeira saída. Nenhum agente pode aprovar a própria mensagem.",
    ],
    proof:
      "Uma execução com modelo, tokens, resultado revisado e limite de gasto registrado.",
  },
  {
    id: "apollo",
    title: "Validar prospecção no Apollo",
    area: "evolucao",
    priority: 85,
    agent: "Pesquisador",
    minutes: 20,
    href: "/admin/prospeccao/buscas",
    trigger: "Antes da primeira importação ou enriquecimento.",
    steps: [
      "Configurar chave Apollo no Console; escolher Brasil, serviços B2B, porte e cargos.",
      "Pesquisar até cinco registros de teste sem revelar dados pagos; verificar identidade e empresa.",
      "Aprovar explicitamente o lote de enriquecimento e teto de créditos; importar sem duplicar e manter pendente para contato.",
    ],
    proof:
      "Lote revisado com origem, Apollo ID, bloqueios e consumo real de créditos.",
  },
  {
    id: "email",
    title: "Liberar o canal de e-mail adequado",
    area: "evolucao",
    priority: 85,
    agent: "Engajamento",
    minutes: 20,
    href: "/admin/configuracoes/parametros",
    trigger: "Antes de qualquer cadência com envio automático.",
    steps: [
      "Para prospecção: validar conta Gmail/Apollo e regras do provedor; registrar remetente e limites.",
      "Para Resend: usar apenas destinatários com opt-in, propostas solicitadas e notificações; verificar domínio e remetente.",
      "Testar envio para a própria equipe, resposta, recusa e pausa da cadência. Só liberar lote com destinatários e texto revisados.",
    ],
    proof:
      "Envio e resposta de teste, descadastro funcionando e nenhuma duplicação.",
  },
  {
    id: "whatsapp",
    title: "Conectar WhatsApp Business oficial",
    area: "evolucao",
    priority: 85,
    agent: "Relacionamento",
    minutes: 30,
    href: "https://business.facebook.com/",
    trigger: "Antes de automatizar mensagens no número Salestrack.",
    steps: [
      "Confirmar Business Portfolio, conta WhatsApp Business e vínculo do número +55 11 98929-6817.",
      "Escolher configuração oficial compatível com o uso atual do número; não desconectar o aplicativo sem avaliar a migração.",
      "Configurar token, phone_number_id, webhook e assinatura; registrar opt-in por contato e aprovar templates.",
      "Validar entrada de mensagem, resposta dentro da janela e template fora dela; simular recusa e bloquear continuidade.",
    ],
    proof:
      "Mensagem de teste real com ID da Meta, resposta recebida e opt-out respeitado.",
  },
  {
    id: "linkedin",
    title: "Operar sinais do LinkedIn com evidências",
    area: "evolucao",
    priority: 80,
    agent: "Pesquisador de sinais",
    minutes: 15,
    href: "/admin/prospeccao/sinais-linkedin",
    trigger: "Em toda coleta; antes de cadastrar sinal como validado.",
    steps: [
      "Usar pesquisa pública acessível ou revisão manual no Sales Navigator. API SNAP depende de autorização específica.",
      "Abrir o post; registrar URL, autor, empresa, data real e trecho pertinente. Curtida ou repost genérico não valida intenção.",
      "S3: pedido/dor explícita recente; S2: aplicação concreta. Fonte incompleta permanece pendente.",
      "Conferir identidade, duplicados e bloqueios. Não usar cookies de sessão nem contornar login/restrições.",
    ],
    proof:
      "Fonte verificável por sinal e status separado de hipótese; sem envio automático no LinkedIn.",
  },
  {
    id: "docusign",
    title: "Validar proposta e assinatura",
    area: "evolucao",
    priority: 75,
    agent: "Propostas",
    minutes: 25,
    href: "/admin/contratos",
    trigger: "Antes da primeira proposta para assinatura.",
    steps: [
      "Conferir dados jurídicos, escopo, valores e signatários com André.",
      "Configurar integração DocuSign no servidor (Integration Key, consentimento, RSA e webhook HMAC), ou enviar manualmente pela conta conectada.",
      "Testar envelope interno, evento de assinatura e arquivo final. Não marcar contrato como assinado com base em intenção.",
    ],
    proof:
      "Envelope de teste concluído, evento autenticado e PDF final vinculado ao negócio.",
  },
  {
    id: "rotinas",
    title: "Ativar automações com limites e pausa",
    area: "evolucao",
    priority: 70,
    agent: "Supervisor",
    minutes: 20,
    href: "/admin/administracao",
    trigger: "Após o fluxo ponta a ponta funcionar manualmente.",
    steps: [
      "Revisar os crons já existentes para evitar duas rotinas prospectando ou enviando para o mesmo contato.",
      "Começar com preparação interna e aprovação humana; definir contatos/dia, créditos, tokens, horários e proprietário.",
      "Testar repetição da execução, falha de canal, recusa e botão de pausa.",
      "Ativar cada rotina separadamente e conferir o log do dia seguinte.",
    ],
    proof:
      "Execução idempotente registrada, pausas testadas e agenda aprovada.",
  },
  {
    id: "dados",
    title: "Conciliar base existente e HubSpot",
    area: "evolucao",
    priority: 65,
    agent: "Qualificador",
    minutes: 25,
    href: "/admin/crm/importar",
    trigger: "Antes de importar a base ou operar dois CRMs.",
    steps: [
      "Exportar backup do painel diário e da planilha. Manter bloqueios e campos manuais.",
      "Escolher Salestrack OS como fonte principal; HubSpot fica como sistema externo até definir sincronização e conflitos.",
      "Importar lote de teste e conferir deduplicação por identidade/empresa e URL normalizada.",
      "Somente depois importar o restante. Nunca reiniciar cadência existente ao fundir registros.",
    ],
    proof: "Contagens reconciliadas, backup disponível e registros revisados.",
  },
];
export const AGENTS = [
  {
    key: "sinais",
    name: "Pesquisador de sinais",
    output: "Fontes, autor, data e hipótese separada de fato.",
    href: "/admin/prospeccao/sinais-linkedin",
  },
  {
    key: "qualificacao",
    name: "Qualificador",
    output: "Aderência, identidade, bloqueios e prioridade.",
    href: "/admin/prospeccao/aprovacao",
  },
  {
    key: "engajamento",
    name: "Redator de abordagens",
    output: "Rascunhos por contexto e canal para aprovação.",
    href: "/admin/prospeccao/mensagens",
  },
  {
    key: "respostas",
    name: "Analista de respostas",
    output: "Interesse, dúvida, recusa ou necessidade de André.",
    href: "/admin/relacionamento",
  },
  {
    key: "fechamento",
    name: "Estrategista de negócios",
    output: "Riscos, próximo passo e preparação da reunião.",
    href: "/admin/crm",
  },
  {
    key: "propostas",
    name: "Arquiteto de propostas",
    output: "Escopo específico, entregas, dependências e revisão de preço.",
    href: "/admin/propostas",
  },
  {
    key: "projetos",
    name: "Coordenador de entregas",
    output: "Tarefas, responsáveis, prazos e aceite após contratação.",
    href: "/admin/entregas",
  },
  {
    key: "supervisor",
    name: "Supervisor diário",
    output: "Resumo, pendências, falhas e prioridade do dia.",
    href: "/admin/central",
  },
];
export function buildRoutine(
  day: string,
  deals: DealInput[],
  tasks: TaskInput[],
  progress: Record<string, Progress> = {},
): Item[] {
  if (!validDay(day)) throw Error("Data inválida");
  const result: Item[] = tasks
    .filter((t) => t.due_date && t.due_date.slice(0, 10) <= day)
    .map((t) => ({
      id: `tarefa-${t.id}`,
      title: t.title,
      area: "vendas",
      priority: 98,
      agent: "Supervisor",
      minutes: 10,
      href: "/admin/tarefas",
      trigger: `Tarefa com prazo ${t.due_date?.slice(0, 10)}`,
      steps: [
        "Abrir a tarefa e conferir o contexto.",
        "Executar ou reagendar com justificativa e responsável.",
        "Concluir também no módulo de tarefas quando a ação estiver feita.",
      ],
      proof: "Resultado ou nova data registrado na tarefa de origem.",
    }));
  for (const d of deals.filter(
    (d) => !["cliente", "perdido"].includes(d.stage),
  )) {
    const closing = ["proposta", "fechamento"].includes(d.stage);
    result.push({
      id: `negocio-${d.id}`,
      title: closing
        ? `Avançar decisão: ${d.title}`
        : `Definir próximo passo: ${d.title}`,
      area: "vendas",
      priority: closing ? 92 : 60,
      agent: "Estrategista de negócios",
      minutes: 15,
      href: `/admin/crm/${d.id}`,
      trigger: `Negócio em ${d.stage}. Prioridade por etapa, sem inferir intenção de compra.`,
      steps: [
        "Ler histórico e última resposta; verificar se há recusa ou bloqueio.",
        "Confirmar a prioridade empresarial, patrocinador e o que impede a decisão.",
        "Preparar uma pergunta ou encaminhamento específico; registrar responsável e data.",
      ],
      proof: "Próxima ação combinada ou motivo documentado de encerramento.",
    });
  }
  result.push(
    {
      id: "pesquisa",
      title: "Revisar sinais e selecionar contatos pertinentes",
      area: "vendas",
      priority: 55,
      agent: "Pesquisador",
      minutes: 25,
      href: "/admin/prospeccao",
      trigger: "Bloco diário de novas oportunidades.",
      steps: [
        "Revisar até cinco candidatos com identidade e vínculo confirmados.",
        "Consultar bloqueios e histórico antes de preparar qualquer contato.",
        "Sem fonte verificável: marcar pendente. Se não houver candidatos válidos, registrar zero e trabalhar relações existentes.",
      ],
      proof: "Lista revisada com origem; nenhum contato fictício.",
    },
    {
      id: "conteudo",
      title: "Preparar um conteúdo que abra conversas",
      area: "vendas",
      priority: 40,
      agent: "Redator",
      minutes: 20,
      href: "/admin/marketing",
      trigger: "Depois de tratar retornos e oportunidades em decisão.",
      steps: [
        "Escolher uma prioridade real de uma área da empresa.",
        "Gerar um texto sobre processo, tecnologia e IA; evitar promessas e casos inventados.",
        "Revisar, publicar no canal escolhido e registrar as conversas originadas.",
      ],
      proof: "Link da publicação ou rascunho explicitamente marcado.",
    },
    {
      id: "fechar-dia",
      title: "Consolidar resultados e organizar amanhã",
      area: "vendas",
      priority: 10,
      agent: "Supervisor",
      minutes: 10,
      href: "/admin/hoje",
      trigger: "Fim do expediente.",
      steps: [
        "Separar abordagens, respostas, reuniões, propostas, contratado e recebido.",
        "Garantir próximo passo, responsável e data em cada oportunidade aberta.",
        "Registrar bloqueios e selecionar apenas uma melhoria operacional para amanhã.",
      ],
      proof: "Resumo com números realizados e fila de amanhã.",
    },
  );
  const backlog = BACKLOG.filter(
    (b) => progress[`backlog:${b.id}`]?.status !== "concluido",
  ).sort((a, b) => b.priority - a.priority);
  return prioritizeItems([...result, ...backlog.slice(0, 2)]);
}
export function progressKey(day: string, item: Item) {
  return item.area === "evolucao"
    ? `backlog:${item.id}`
    : `day:${day}:${item.id}`;
}

export function prioritizeItems(items:Item[]) { return items.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)); }
