/**
 * O conteúdo do registro de operações de tratamento (LGPD art. 37).
 *
 * ── A disciplina que sustenta este arquivo ───────────────────────────────────────────────────
 * Cada linha aqui foi escrita a partir do que o sistema FAZ — o schema, o código das integrações,
 * o cron de retenção — e não do que seria confortável declarar. `ondeNoSistema` existe para isso:
 * é o endereço que permite conferir a linha contra o código em vez de acreditar nela.
 *
 * Uma política de privacidade que descreve um sistema imaginário é pior do que não ter política:
 * vira promessa escrita que o próprio produto desmente, e é assim que uma multa acontece.
 *
 * ── Módulo puro ──────────────────────────────────────────────────────────────────────────────
 * Sem "server-only": é o mesmo conteúdo que a página pública mostra e que o seed grava. A tabela
 * `tratamento_operacoes` é a fonte de leitura em produção (dá para editar sem deploy); este arquivo
 * é a semente e o histórico versionado dela.
 */

export type Operacao = {
  chave: string;
  ordem: number;
  nome: string;
  finalidade: string;
  baseLegal: BaseLegal;
  titulares: string;
  dados: string;
  origem: string;
  compartilhamento?: string;
  retencao: string;
  ondeNoSistema?: string;
  observacao?: string;
};

export type BaseLegal =
  | "consentimento" | "execucao_contrato" | "legitimo_interesse"
  | "obrigacao_legal" | "exercicio_direitos" | "protecao_credito" | "procedimento_preliminar";

/** Como cada base legal é dita para quem não é advogado, com o artigo entre parênteses. */
export const BASE_LEGAL_TEXTO: Record<BaseLegal, string> = {
  consentimento: "você autorizou (art. 7º, I)",
  execucao_contrato: "é necessário para cumprir um contrato com você ou com sua empresa (art. 7º, V)",
  procedimento_preliminar: "você nos procurou e isso é o passo anterior a um contrato (art. 7º, V)",
  legitimo_interesse: "legítimo interesse (art. 7º, IX)",
  obrigacao_legal: "a lei nos obriga a guardar (art. 7º, II)",
  exercicio_direitos: "é necessário para exercer direitos em processo (art. 7º, VI)",
  protecao_credito: "proteção ao crédito (art. 7º, X)",
};

export const OPERACOES: Operacao[] = [
  {
    chave: "contato_site",
    ordem: 10,
    nome: "Quem fala com a gente pelos sites",
    finalidade: "Responder ao contato que você iniciou e entender o que sua empresa precisa.",
    baseLegal: "procedimento_preliminar",
    titulares: "Quem preenche o formulário de contato em salestrack.com.br ou andrekachan.com.br.",
    dados: "Nome, e-mail, WhatsApp, empresa e a mensagem que você escreveu.",
    origem: "Você mesmo, no formulário.",
    compartilhamento: "Ninguém fora dos operadores listados abaixo.",
    retencao:
      "Enquanto durar o atendimento. Se virar uma oportunidade comercial, o contato passa para o CRM e segue a linha de clientes; se não virar nada, você pode pedir a exclusão a qualquer momento.",
    ondeNoSistema: "site_leads, andrekachan_leads, contacts",
  },
  {
    chave: "newsletter",
    ordem: 20,
    nome: "Newsletter e e-mails de conteúdo",
    finalidade: "Enviar o conteúdo que você pediu para receber.",
    baseLegal: "consentimento",
    titulares: "Quem se inscreveu e confirmou pelo e-mail.",
    dados:
      "E-mail, nome e empresa (opcionais), mais a evidência do seu aceite: a data, o texto exato que você leu, o IP e o navegador. Também registramos se a mensagem foi entregue, aberta ou clicada.",
    origem: "Você mesmo, no formulário de inscrição, com confirmação por e-mail.",
    compartilhamento: "Resend, que entrega as mensagens.",
    retencao:
      "Enquanto você quiser receber. O link de descadastro em cada e-mail encerra o envio no primeiro clique, e o endereço entra numa lista de bloqueio para não voltar por engano — essa lista guarda só o endereço, e existe justamente para respeitar a sua saída.",
    ondeNoSistema: "newsletter_inscricoes, consent_records, email_envios, email_supressao",
    observacao:
      "A inscrição só vale depois do clique de confirmação. Antes dele, nada é enviado e o endereço não entra em lista nenhuma.",
  },
  {
    chave: "prospeccao",
    ordem: 30,
    nome: "Prospecção comercial B2B",
    finalidade:
      "Identificar profissionais que provavelmente têm o problema que resolvemos, e fazer um primeiro contato profissional.",
    baseLegal: "legitimo_interesse",
    titulares: "Profissionais com poder de decisão em empresas — nunca pessoas físicas fora do contexto de trabalho.",
    dados:
      "Só dado profissional: nome, cargo, empresa, e-mail corporativo e perfil público no LinkedIn. Nunca telefone pessoal, endereço residencial ou qualquer dado sensível.",
    origem:
      "Bases profissionais de terceiros (Apollo) e informação profissional pública. Você não nos procurou — é por isso que a primeira mensagem já diz de onde viemos e como sair.",
    compartilhamento:
      "Apollo, de onde o dado vem; a Anthropic, cujo modelo ajuda a escrever o texto da mensagem; e quem entrega o e-mail.",
    retencao:
      "180 dias contados da coleta. Passado o prazo sem nenhuma conversa, o dado é apagado automaticamente todos os dias por uma rotina. Se você pedir para não ser contatado, a exclusão é imediata e não espera prazo nenhum.",
    ondeNoSistema: "prospects, prospect_accounts, outreach_messages, lib/lgpd/retencao.ts",
    observacao:
      "Legítimo interesse não é carta branca: ele vale porque o tratamento é restrito a dado profissional, tem finalidade específica, tem prazo de descarte e tem uma via de oposição em cada mensagem. Faltando qualquer um desses, a base cai.",
  },
  {
    chave: "clientes",
    ordem: 40,
    nome: "Clientes, propostas e contratos",
    finalidade:
      "Emitir proposta, assinar contrato, faturar, entregar o trabalho contratado e acompanhar o projeto.",
    baseLegal: "execucao_contrato",
    titulares: "Pessoas de contato das empresas clientes — quem assina, quem patrocina e quem toca o projeto.",
    dados:
      "Nome, e-mail corporativo, cargo, dados de faturamento da empresa e o registro de quando a proposta foi aberta e lida.",
    origem: "A própria empresa cliente, durante a negociação.",
    compartilhamento: "ASAAS, para emitir e cobrar as faturas; Docusign, quando o contrato é assinado eletronicamente.",
    retencao:
      "Durante o contrato e depois pelo prazo em que a lei manda guardar documento fiscal e prova de obrigação. Um pedido de exclusão não apaga contrato assinado — a lei ressalva expressamente essa guarda (art. 16, I e III); o que fazemos é anonimizar o que identifica pessoas além do necessário.",
    ondeNoSistema: "organizations, contacts, deals, proposals, contracts, invoices",
  },
  {
    chave: "atendimento",
    ordem: 50,
    nome: "Caixa de e-mail e WhatsApp da Salestrack",
    finalidade: "Receber, organizar e responder as mensagens que chegam para a empresa.",
    baseLegal: "legitimo_interesse",
    titulares: "Qualquer pessoa que escreve para a Salestrack.",
    dados: "O conteúdo da mensagem, o endereço ou telefone de origem e o histórico da conversa.",
    origem: "A própria mensagem que você enviou.",
    compartilhamento:
      "Google, que hospeda a caixa de e-mail; Z-API, que faz a ponte com o WhatsApp; e a Anthropic, cujo modelo lê as mensagens para separar o que precisa de resposta e preparar um rascunho.",
    retencao: "Enquanto o relacionamento existir. Você pode pedir a exclusão do histórico a qualquer momento.",
    ondeNoSistema: "rel_conversas, rel_mensagens, wa_messages, lib/relacionamento/",
    observacao:
      "Dizemos isto de forma direta porque é o ponto que mais surpreende: um modelo de IA lê as mensagens que chegam, para triar e rascunhar. Nenhuma resposta é enviada sozinha — quem decide e envia é uma pessoa. O modelo não usa esse conteúdo para treinar nada.",
  },
  {
    chave: "academy",
    ordem: 60,
    nome: "Formação e certificado",
    finalidade: "Dar acesso ao curso, guardar seu progresso, corrigir a avaliação e emitir o certificado.",
    baseLegal: "execucao_contrato",
    titulares: "Alunos, individuais ou de empresas clientes.",
    dados: "Nome, e-mail, progresso nas aulas, respostas da avaliação, nota e certificado emitido.",
    origem: "Sua matrícula e o seu uso da plataforma.",
    compartilhamento:
      "Quando a matrícula é paga pela sua empresa, o gestor dela vê seu progresso e sua nota — mas não vê as suas respostas da prova.",
    retencao:
      "O progresso enquanto a matrícula durar. O certificado é permanente, porque ele é a prova de que você concluiu e precisa continuar verificável.",
    ondeNoSistema: "academy_enrollments, academy_progress, academy_attempts, formacao_certificados",
  },
  {
    chave: "acesso",
    ordem: 70,
    nome: "Sua conta de acesso",
    finalidade: "Deixar você entrar e mostrar só o que é seu.",
    baseLegal: "execucao_contrato",
    titulares: "Quem tem login no AI OS — equipe Salestrack, pessoas das empresas clientes e alunos.",
    dados: "E-mail, senha guardada de forma cifrada (nunca em texto), papel e a empresa a que você pertence.",
    origem: "O convite que você aceitou ou o cadastro que você fez.",
    retencao: "Enquanto a conta existir.",
    ondeNoSistema: "auth.users (Supabase Auth), memberships, invites",
  },
  {
    chave: "auditoria",
    ordem: 80,
    nome: "Trilha de auditoria",
    finalidade:
      "Registrar quem fez o quê e quando dentro do sistema, para investigar um incidente e provar que uma obrigação foi cumprida.",
    baseLegal: "obrigacao_legal",
    titulares: "Quem opera o sistema.",
    dados: "A ação praticada, o momento, o usuário e o IP.",
    origem: "O próprio uso do sistema.",
    retencao:
      "Permanente, e a trilha não aceita alteração nem apagamento — nem por administrador. É uma escolha de projeto: uma trilha que pode ser editada não prova nada.",
    ondeNoSistema: "audit_logs (insert-only, com encadeamento de hash)",
    observacao:
      "Um pedido de exclusão não apaga a trilha. Direito ao esquecimento e dever de manter registro são obrigações distintas, e a lei ressalva a segunda (art. 16, I). O que a trilha guarda sobre você é o registro da operação, não o conteúdo dos seus dados.",
  },
  {
    chave: "direitos",
    ordem: 90,
    nome: "Seus pedidos sobre seus dados",
    finalidade: "Receber, atender e comprovar o atendimento dos pedidos de acesso, correção, exclusão e portabilidade.",
    baseLegal: "obrigacao_legal",
    titulares: "Qualquer pessoa que faz um pedido.",
    dados:
      "Seu e-mail, o que você pediu e uma fotografia do que existia sobre você no momento do pedido — é ela que sustenta a resposta depois que os dados forem apagados.",
    origem: "Você, pela página de direitos ou escrevendo para o encarregado.",
    retencao:
      "Guardado como prova de que o pedido foi atendido no prazo. É o registro que a ANPD pede se algum dia perguntar.",
    ondeNoSistema: "dsr_requests, dsr_confirmacoes",
  },
];

export type Operador = {
  chave: string;
  ordem: number;
  nome: string;
  papel: string;
  dados: string;
  pais: string;
  site?: string;
  /** Fora do ar hoje. Fica na semente para que ligar a integração seja trocar uma flag, não redigir texto às pressas. */
  inativo?: boolean;
};

export const OPERADORES: Operador[] = [
  { chave: "supabase", ordem: 10, nome: "Supabase", papel: "Guarda o banco de dados e cuida do login.", dados: "Todos os dados descritos acima.", pais: "Brasil (São Paulo)", site: "https://supabase.com/privacy" },
  { chave: "vercel", ordem: 20, nome: "Vercel", papel: "Hospeda os sites e o sistema.", dados: "Os dados trafegam por lá ao serem enviados e exibidos.", pais: "Estados Unidos", site: "https://vercel.com/legal/privacy-policy" },
  { chave: "resend", ordem: 30, nome: "Resend", papel: "Entrega os e-mails que enviamos.", dados: "Nome, e-mail e o conteúdo da mensagem.", pais: "Estados Unidos", site: "https://resend.com/legal/privacy-policy" },
  { chave: "anthropic", ordem: 40, nome: "Anthropic (Claude)", papel: "Modelo de IA que lê mensagens para triar e ajuda a redigir textos.", dados: "O conteúdo das mensagens tratadas e o contexto do CRM necessário para a tarefa.", pais: "Estados Unidos", site: "https://www.anthropic.com/legal/privacy" },
  { chave: "google", ordem: 50, nome: "Google Workspace", papel: "Hospeda a caixa de e-mail e a agenda da Salestrack.", dados: "Mensagens recebidas e enviadas, e compromissos.", pais: "Estados Unidos", site: "https://policies.google.com/privacy" },
  { chave: "apollo", ordem: 60, nome: "Apollo.io", papel: "Base profissional usada na prospecção B2B.", dados: "Dado profissional público: nome, cargo, empresa, e-mail corporativo.", pais: "Estados Unidos", site: "https://www.apollo.io/privacy-policy" },
  { chave: "asaas", ordem: 70, nome: "ASAAS", papel: "Emite e cobra as faturas dos clientes.", dados: "Dados de faturamento da empresa e contato do responsável financeiro.", pais: "Brasil", site: "https://www.asaas.com/politica-de-privacidade" },
  { chave: "zapi", ordem: 80, nome: "Z-API", papel: "Faz a ponte entre o WhatsApp e o sistema.", dados: "Telefone e conteúdo das mensagens de WhatsApp.", pais: "Brasil", site: "https://z-api.io" },
  { chave: "mailerlite", ordem: 90, nome: "MailerLite", papel: "Lista de nutrição usada em parte das ações de marketing.", dados: "Nome, e-mail e empresa.", pais: "Lituânia (União Europeia)", site: "https://www.mailerlite.com/legal/privacy-policy" },
  { chave: "docusign", ordem: 100, nome: "Docusign", papel: "Assinatura eletrônica de contratos.", dados: "Nome, e-mail e o documento assinado.", pais: "Estados Unidos", site: "https://www.docusign.com/company/privacy-policy", inativo: true },
];

/**
 * O aviso de transferência internacional, montado a partir da lista — não escrito à mão.
 *
 * Escrito à mão, ele envelheceria no dia em que um operador entrasse ou saísse, e a página passaria
 * a afirmar um destino errado. Derivado, ele não tem como divergir.
 */
export function paisesForaDoBrasil(operadores: Operador[] = OPERADORES): string[] {
  return [...new Set(operadores.filter((o) => !o.inativo && !/^Brasil/.test(o.pais)).map((o) => o.pais))].sort();
}
