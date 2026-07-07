/**
 * Registro de ajuda "Como usar" por rota (Salestrack AI v2). Linguagem simples, sem jargão.
 * Módulo NEUTRO (data) — pode ser importado por client e server. Sem entrada = ajuda oculta.
 */
export type Help = { titulo: string; oQueE: string; passos: string[]; dica?: string };

export const HELP: Record<string, Help> = {
  // ── Admin (6 áreas + cockpit) ──
  "/admin/hoje": {
    titulo: "Hoje", oQueE: "Seu ponto de partida. Mostra o que precisa de você agora — sem você precisar procurar.",
    passos: ["Veja as ações do dia no topo e resolva as mais urgentes.", "Confira alertas, o funil em movimento e as sessões da semana.", "As aprovações pendentes ficam à mão para você liberar."],
    dica: "Se estiver tudo em dia, é um bom momento para prospectar.",
  },
  "/admin/clientes": {
    titulo: "Clientes", oQueE: "A entrega e a saúde de cada cliente em um só lugar.",
    passos: ["Cadastre um novo cliente pelo botão no topo.", "Abra Programas para acompanhar a entrega de cada um.", "Use o Consultor e o ROI para mostrar valor ao cliente."],
  },
  "/admin/comercial": {
    titulo: "Comercial", oQueE: "Seu funil do começo ao fim: do primeiro sinal até virar cliente.",
    passos: ["No CRM você move os negócios entre as etapas.", "Gere e envie propostas; acompanhe quando forem lidas.", "Feche com contrato e assinatura."],
    dica: "Prospecção é por sinal, não por volume — qualifique antes de abordar.",
  },
  "/admin/estudio-area": {
    titulo: "Estúdio", oQueE: "A fábrica dos seus entregáveis executivos — propostas, ROI, dossiês e apresentações.",
    passos: ["Gere um entregável a partir de um ROI, deal ou prospect.", "Revise e aprove antes de enviar ao cliente.", "Baixe em PDF, PPTX ou compartilhe por link seguro."],
  },
  "/admin/metodo": {
    titulo: "Método", oQueE: "O seu método de IA vira produto: catálogo, templates e trilhas reutilizáveis.",
    passos: ["No Estúdio do Método você edita receitas e trilhas.", "Templates são blueprints prontos por segmento.", "O Catálogo guarda os itens de serviço (André Kachan + Salestrack)."],
  },
  "/admin/plataforma": {
    titulo: "Plataforma", oQueE: "A operação por trás do negócio: configuração, cobrança, custos e governança.",
    passos: ["Em Configurações você ajusta tudo (IA, integrações, segurança).", "Financeiro e Monetização cuidam de faturas e planos.", "Operações mostra custo de IA, margem e alertas."],
  },
  // ── Portal (Jornada + 4 áreas) ──
  "/portal": {
    titulo: "Jornada principal", oQueE: "O seu programa de IA, etapa por etapa. A etapa em destaque é onde você está agora.",
    passos: ["Acompanhe o ciclo do mês e o progresso do programa.", "Veja seus entregáveis e a próxima sessão ao vivo.", "Fale com o Consultor sempre que tiver dúvidas."],
    dica: "O ciclo recomeça a cada mês — é assim que a evolução acontece.",
  },
  "/portal/visao": {
    titulo: "Visão geral", oQueE: "Os resultados e materiais do seu programa reunidos.",
    passos: ["Veja o ROI para entender o valor gerado no mês.", "Baixe os entregáveis executivos prontos.", "Acesse a biblioteca de materiais quando precisar."],
  },
  "/portal/copilotos": {
    titulo: "Copilotos", oQueE: "Seus assistentes de IA, sempre à mão.",
    passos: ["O Consultor resume seu andamento e tira dúvidas.", "O Playbook traz receitas práticas para aplicar com IA.", "Comece perguntando qualquer coisa ao Consultor."],
  },
  "/portal/automacoes": {
    titulo: "Automações", oQueE: "O que roda por você: seu stack de IA e as sessões ao vivo.",
    passos: ["Veja as ferramentas e agentes do seu programa.", "Acompanhe as sessões agendadas e entre pela sala.", "Use os créditos de sessão disponíveis."],
  },
  "/portal/config": {
    titulo: "Configurações", oQueE: "Equipe, financeiro e governança do seu programa.",
    passos: ["Convide pessoas do seu time para o portal.", "Acompanhe faturas e a situação da assinatura.", "Veja a política e a segurança do seu stack de IA."],
  },

  // ── Estúdio (R3) ──
  "/admin/entregaveis": {
    titulo: "Estúdio de Entregáveis", oQueE: "A fábrica de tudo que você entrega: documentos, apresentações, formação, mensagens, arte e vídeo — na identidade Salestrack AI.",
    passos: ["Escolha o tipo em ‘Nova produção’ e o cliente.", "A IA rascunha; você revisa e aprova (aprovado trava o conteúdo).", "Publique — pronto para o cliente ou para a Comunicação disparar."],
    dica: "Regra de ouro: a IA rascunha, você aprova, o sistema publica.",
  },
  "/admin/entregaveis/identidade": {
    titulo: "Identidade do programa", oQueE: "A cara de cada programa dentro do design v2: logo, nome, capa e um acento da paleta.",
    passos: ["Preencha nome, logo e textos de capa do programa.", "Escolha um acento da paleta v2 e a atribuição de marca.", "Aprove para ativar — daí toda entrega sai com essa identidade."],
  },
  "/admin/comunicacao": {
    titulo: "Comunicação (régua)", oQueE: "O motor que conduz o cliente: define o que comunicar, por qual gatilho e quando, ao longo do ciclo.",
    passos: ["Monte os passos por fase e o gatilho de cada um.", "Vincule um ativo aprovado do Estúdio (senão o passo fica ‘incompleto’).", "Na fila de envio, aprove as comunicações antes de saírem (supervisão)."],
    dica: "Nada dispara sem um ativo aprovado — e, por padrão, sem a sua aprovação.",
  },

  "/admin/relacionamento": {
    titulo: "Relacionamento", oQueE: "A caixa de e-mail e as mensagens de WhatsApp da equipe, em um lugar — com atribuição por membro e vínculo ao cliente.",
    passos: ["Abra a Caixa de entrada (e-mail) ou Mensagens (WhatsApp).", "Atribua a conversa a um membro da equipe.", "Vincule ao cliente e responda pela plataforma."],
    dica: "É uma inbox de equipe: cada conversa tem um responsável, e as novidades aparecem no Hoje.",
  },

  // ── Comercial (subtelas) ──
  "/admin/crm": { titulo: "CRM", oQueE: "Seu pipeline: onde cada negócio está e o que fazer a seguir.", passos: ["Arraste os cards entre as etapas do funil.", "Abra um negócio para ver contatos e histórico.", "Registre a próxima ação para não perder o timing."] },
  "/admin/prospeccao": { titulo: "Prospecção", oQueE: "Encontrar e abordar os clientes certos por sinal, não por volume.", passos: ["Veja os sinais que elevam o score do prospect.", "Use as cadências para abordar no tempo certo.", "Qualifique antes de investir energia."] },
  "/admin/propostas": { titulo: "Propostas", oQueE: "Gerar, enviar e acompanhar propostas até o fechamento.", passos: ["Gere a proposta a partir de uma oferta do catálogo.", "Envie e acompanhe quando for lida.", "Ao fechar, o programa do cliente é provisionado."] },
  "/admin/contratos": { titulo: "Contratos", oQueE: "Da minuta à assinatura, e daí ao kickoff.", passos: ["Gere a minuta a partir da proposta.", "Colete a assinatura (Docusign ou manual).", "Assinado, o kickoff prepara o programa."] },
  "/admin/ofertas": { titulo: "Ofertas", oQueE: "O catálogo comercial que alimenta as propostas (Diagnose, Sprint, Mentoria, workshops).", passos: ["Cadastre e edite as ofertas com preço e escopo.", "Elas ficam disponíveis para montar propostas.", "É oferta entregue no AI OS — não é plano de plataforma."] },

  // ── Método & Plataforma (subtelas) ──
  "/admin/estudio": { titulo: "Estúdio do Método", oQueE: "Onde seu método vira produto: receitas, trilhas e sessões.", passos: ["Edite as Receitas do Playbook.", "Monte trilhas e sessões ao vivo.", "Tudo isso reaparece para o cliente no portal."] },
  "/admin/catalogo": { titulo: "Catálogo", oQueE: "Os itens de serviço (André Kachan + Salestrack) que compõem as ofertas.", passos: ["Cadastre itens com preço e marca.", "Combine-os nas ofertas comerciais.", "Mantenha ativo o que está à venda."] },
  "/admin/financeiro": { titulo: "Financeiro", oQueE: "Faturas e recebíveis das ofertas vendidas.", passos: ["Acompanhe faturas emitidas e pagas.", "Veja recebíveis por período.", "Concilie com o provedor de cobrança."] },
  "/admin/operacoes": { titulo: "Operações", oQueE: "A saúde interna: custo de IA, margem e alertas.", passos: ["Veja o custo de IA (FinOps) por período.", "Acompanhe a saúde dos clientes.", "Aja nos alertas antes que virem problema."] },
  "/admin/configuracoes": { titulo: "Configurações", oQueE: "Todos os parâmetros do sistema: IA, integrações e segurança.", passos: ["Ajuste o modelo e as chaves de IA.", "Conecte integrações (WhatsApp, e-mail, assinatura).", "Defina políticas de segurança."] },
  "/admin/roi": { titulo: "ROI / Sucesso", oQueE: "O valor gerado para cada cliente, mês a mês.", passos: ["Gere o relatório de ROI do período.", "Mostre os números como prova ao cliente.", "Use para retenção e expansão."] },

  // ── Portal (subtelas) ──
  "/portal/consultor": { titulo: "Consultor", oQueE: "Seu copiloto de IA: tira dúvidas, resume o andamento e guia pelas receitas.", passos: ["Pergunte qualquer coisa sobre o seu programa.", "Peça um resumo do mês ou o próximo passo.", "Ele só usa os dados do seu programa — nada de fora."] },
  "/portal/playbook": { titulo: "Playbook", oQueE: "Receitas práticas para aplicar IA no seu dia a dia.", passos: ["Escolha uma receita da sua frente.", "Siga o passo a passo com o prompt pronto.", "Rode com o time e meça o ganho."] },
  "/portal/stack": { titulo: "Stack de IA", oQueE: "As ferramentas e agentes que rodam no seu programa.", passos: ["Veja o que está ativo no seu stack.", "Entenda o que cada peça faz por você.", "Fale com o Consultor se algo não estiver claro."] },
  "/portal/sessoes": { titulo: "Sessões ao Vivo", oQueE: "Suas sessões de capacitação e mentoria.", passos: ["Veja as próximas sessões agendadas.", "Entre pela sala no horário.", "Acompanhe seus créditos de sessão."] },
  "/portal/entregaveis": { titulo: "Entregáveis", oQueE: "Os documentos e materiais prontos do seu programa.", passos: ["Baixe os entregáveis publicados.", "Cada um sai no design Salestrack AI.", "Peça ao Consultor um resumo quando quiser."] },
  "/portal/roi": { titulo: "Resultados / ROI", oQueE: "O valor que a IA gerou no seu programa.", passos: ["Veja os indicadores do período.", "Entenda a narrativa por trás dos números.", "Use para justificar e evoluir o programa."] },
  "/portal/equipe": { titulo: "Equipe", oQueE: "Quem tem acesso ao seu portal.", passos: ["Convide pessoas do seu time.", "Defina o papel de cada uma.", "Remova acessos quando necessário."] },
};

export function helpFor(routeKey: string): Help | null {
  return HELP[routeKey] ?? null;
}

/** Todos os guias (para o hub de ajuda buscável), com a superfície derivada da rota. */
export function allGuides(): { href: string; surface: "admin" | "portal"; help: Help }[] {
  return Object.entries(HELP).map(([href, help]) => ({ href, surface: href.startsWith("/portal") ? "portal" : "admin", help }));
}

/** Busca simples por título/descrição/passos (para o hub). */
export function searchGuides(q: string, surface?: "admin" | "portal"): { href: string; surface: "admin" | "portal"; help: Help }[] {
  const term = (q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return allGuides()
    .filter((g) => !surface || g.surface === surface)
    .filter((g) => {
      if (!term) return true;
      const hay = `${g.help.titulo} ${g.help.oQueE} ${g.help.passos.join(" ")} ${g.help.dica ?? ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return hay.includes(term);
    });
}
