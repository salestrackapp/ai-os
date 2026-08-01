import type { Bloco } from "./blocos";

/**
 * Modelos prontos de campanha.
 *
 * Dado puro, importável pelo navegador — a tela precisa mostrar a prévia antes de a pessoa escolher.
 *
 * ── O que faz um modelo ser útil ──────────────────────────────────────────────────────────────
 * Não é o layout: é o TEXTO. Um modelo com "Lorem ipsum" e um botão bonito devolve a folha em
 * branco para quem abriu justamente para não encarar uma. Cada um destes vem escrito ponta a ponta,
 * no tom da Salestrack, com uma ação só — dá para enviar trocando três frases.
 *
 * ── Uma ação por e-mail ───────────────────────────────────────────────────────────────────────
 * Nenhum modelo tem dois botões. Dois pedidos no mesmo e-mail costumam render menos que um: quem
 * lê precisa escolher antes de agir, e escolher é mais caro do que clicar.
 */

export type Template = {
  slug: string;
  nome: string;
  quando: string;
  assunto: string;
  preheader: string;
  blocos: Bloco[];
};

export const TEMPLATES: Template[] = [
  {
    slug: "boas-vindas",
    nome: "Boas-vindas",
    quando: "Primeiro e-mail de quem acabou de se inscrever. Manda logo depois do cadastro — a memória de ter se inscrito dura pouco.",
    assunto: "Bem-vindo(a), {{nome|tudo bem}}?",
    preheader: "O que você vai receber aqui — e com que frequência.",
    blocos: [
      { tipo: "titulo", nivel: 1, texto: "Que bom ter você por aqui" },
      { tipo: "texto", texto: "Sou o André Kachan, da Salestrack AI. Você vai receber, mais ou menos a cada duas semanas, o que estamos aprendendo colocando IA para trabalhar dentro de empresas de verdade — em vendas, marketing, operações, atendimento e backoffice." },
      { tipo: "texto", texto: "Sem teoria e sem novidade de LinkedIn: só o que já testamos com cliente e sabemos que funciona — inclusive o que não funcionou." },
      { tipo: "lista", itens: ["Casos reais por área, com número", "Agentes e automações que dá para copiar", "Governança: usar IA sem shadow AI nem risco de dado", "Como preparar as pessoas, não só as ferramentas", "E o que não vale a pena, para você não perder tempo"] },
      { tipo: "texto", texto: "Se em algum momento não fizer mais sentido, o link de descadastro está no rodapé e funciona no primeiro clique." },
      { tipo: "botao", label: "Ver o que já publicamos", url: "https://salestrack.com.br" },
    ],
  },
  {
    slug: "newsletter",
    nome: "Newsletter",
    quando: "O envio recorrente. Um assunto principal e no máximo dois secundários — newsletter que tenta cobrir tudo não é lida até o fim.",
    assunto: "{{nome|Olá}}, o que aprendemos este mês colocando IA para operar",
    preheader: "Um caso real, um número e uma coisa que deu errado.",
    blocos: [
      { tipo: "titulo", nivel: 1, texto: "O agente que cortou 3 horas por semana do time comercial" },
      { tipo: "texto", texto: "Este mês colocamos no ar um agente que faz a triagem da caixa de entrada antes de qualquer pessoa abrir. O resultado surpreendeu mais pelo tamanho do que pela ideia." },
      { tipo: "citacao", texto: "De 209 conversas abertas, 5 precisavam de resposta humana. O resto era máquina falando com máquina.", autor: "Salestrack AI, operação interna" },
      { tipo: "texto", texto: "O detalhe que faz diferença: a triagem não usa IA para tudo. Metade do trabalho é resolvido por regra simples de remetente, que custa zero e é auditável. A IA só entra no que exige julgamento." },
      { tipo: "divisor" },
      { tipo: "titulo", texto: "O que não funcionou" },
      { tipo: "texto", texto: "Tentamos deixar o agente responder sozinho no WhatsApp. Voltamos atrás antes de subir: erro em canal de cliente chega no celular da pessoa e não tem como recolher. Agora ele escreve o rascunho e alguém envia." },
      { tipo: "botao", label: "Quero conversar sobre o meu caso", url: "https://salestrack.com.br" },
    ],
  },
  {
    slug: "convite-evento",
    nome: "Convite para evento ou webinar",
    quando: "Duas semanas antes, e um lembrete curto na véspera. Data, hora e duração precisam estar acima do botão.",
    assunto: "Convite: {{nome|você}} na próxima sessão ao vivo",
    preheader: "Uma hora, ao vivo, com espaço para perguntas.",
    blocos: [
      { tipo: "titulo", nivel: 1, texto: "Sessão ao vivo: IA que dá resultado comercial" },
      { tipo: "texto", texto: "Vou mostrar, com a tela aberta, três agentes que estão rodando hoje em operações de clientes — e quanto cada um custa por mês." },
      { tipo: "lista", itens: ["Data: [dia] às [hora]", "Duração: 1 hora, com 20 minutos de perguntas", "Onde: link enviado na confirmação"] },
      { tipo: "texto", texto: "As vagas são limitadas porque quero responder pergunta de todo mundo. Se não puder participar ao vivo, inscreva-se do mesmo jeito — mando a gravação." },
      { tipo: "botao", label: "Garantir minha vaga", url: "https://salestrack.com.br" },
    ],
  },
  {
    slug: "case-cliente",
    nome: "Caso de cliente",
    quando: "Prova social. Funciona melhor quando o número aparece antes da história — e quando você tem autorização do cliente para citá-lo.",
    assunto: "Como a [empresa] fez [resultado] em [prazo]",
    preheader: "O que mudou, o que custou e quanto tempo levou.",
    blocos: [
      { tipo: "titulo", nivel: 1, texto: "De 3 dias para 4 horas" },
      { tipo: "texto", texto: "Era o tempo que a equipe da [empresa] levava para preparar uma proposta. O gargalo não era escrever: era juntar informação espalhada em cinco lugares." },
      { tipo: "titulo", texto: "O que foi feito" },
      { tipo: "lista", itens: ["Um agente que monta o rascunho a partir do histórico do cliente", "Aprovação humana antes de qualquer envio", "Rastreamento de leitura para saber quando ligar"] },
      { tipo: "citacao", texto: "[Frase do cliente, com o resultado que mais importou para ele.]", autor: "[Nome], [cargo] na [empresa]" },
      { tipo: "texto", texto: "Se a sua operação tem um gargalo parecido, o diagnóstico leva 45 minutos e você sai dele com o mapa, mesmo que não trabalhe com a gente." },
      { tipo: "botao", label: "Quero o diagnóstico", url: "https://salestrack.com.br" },
    ],
  },
  {
    slug: "lancamento",
    nome: "Lançamento ou nova oferta",
    quando: "Anúncio de algo novo. Diga o que é e para quem NÃO é — isso qualifica melhor do que qualquer argumento de venda.",
    assunto: "Novo: {{nome|}} isto pode resolver o seu gargalo comercial",
    preheader: "O que é, para quem é, e para quem não é.",
    blocos: [
      { tipo: "titulo", nivel: 1, texto: "Chegou o [nome da oferta]" },
      { tipo: "texto", texto: "Em uma frase: [o que é e o que entrega]." },
      { tipo: "titulo", texto: "Para quem é" },
      { tipo: "lista", itens: ["Operações comerciais com time de 5 a 50 pessoas", "Quem já tentou IA e parou no meio", "Quem precisa de resultado em semanas, não em trimestres"] },
      { tipo: "titulo", texto: "Para quem não é" },
      { tipo: "texto", texto: "Se você procura uma ferramenta para instalar e esquecer, não somos nós. O que fazemos exige um responsável do seu lado por algumas horas por semana no começo." },
      { tipo: "botao", label: "Ver como funciona", url: "https://salestrack.com.br" },
    ],
  },
  {
    slug: "reengajamento",
    nome: "Reengajamento",
    quando: "Para quem não abre há meses. Pergunte se deve continuar — limpar a lista melhora a entrega de todos os próximos envios.",
    assunto: "{{nome|Ei}}, ainda faz sentido?",
    preheader: "Dois cliques: continuar recebendo ou sair de vez.",
    blocos: [
      { tipo: "titulo", nivel: 1, texto: "Faz um tempo que a gente não se fala" },
      { tipo: "texto", texto: "Notei que você não abre nossos e-mails há alguns meses. Não tem problema nenhum — caixa de entrada é lugar disputado." },
      { tipo: "texto", texto: "Só não quero ocupar espaço à toa. Se ainda quiser receber, é só clicar abaixo; se não, o link de descadastro no rodapé resolve em um clique e sem ressentimento." },
      { tipo: "botao", label: "Quero continuar recebendo", url: "https://salestrack.com.br" },
    ],
  },
  {
    slug: "pesquisa",
    nome: "Pesquisa rápida",
    quando: "Uma pergunta só. Pesquisa com formulário longo tem resposta de quem já é fã — que é justamente quem menos ensina.",
    assunto: "Uma pergunta, {{nome|se puder}}",
    preheader: "Trinta segundos, uma pergunta só.",
    blocos: [
      { tipo: "titulo", nivel: 1, texto: "Qual é o seu maior gargalo comercial hoje?" },
      { tipo: "texto", texto: "Estou montando o conteúdo dos próximos meses e prefiro escrever sobre o que trava você de verdade, não sobre o que eu acho interessante." },
      { tipo: "texto", texto: "É uma pergunta só, e a resposta cai direto comigo." },
      { tipo: "botao", label: "Responder (30 segundos)", url: "https://salestrack.com.br" },
    ],
  },
  {
    slug: "aviso-simples",
    nome: "Aviso simples",
    quando: "Comunicado curto, sem enfeite: mudança de horário, novo canal, aviso operacional.",
    assunto: "[Assunto direto do aviso]",
    preheader: "Um aviso rápido.",
    blocos: [
      { tipo: "texto", texto: "Olá, {{nome|tudo bem}}?" },
      { tipo: "texto", texto: "[O aviso, em duas ou três frases. Diga primeiro o que mudou, depois o porquê.]" },
      { tipo: "texto", texto: "Qualquer dúvida, é só responder este e-mail." },
    ],
  },
];

export function templatePorSlug(slug: string): Template | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}
