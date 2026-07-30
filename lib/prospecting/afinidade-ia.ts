/**
 * Afinidade com o tema de IA — o quanto a pessoa e a empresa dela já estão dentro do assunto.
 *
 * É diferente de FIT (quem a pessoa é) e de ENGAJAMENTO (se interagiu conosco). Afinidade
 * responde a terceira pergunta: **ela já se move nesse mundo?** Alguém que comenta posts de IA,
 * cujo cargo menciona dados, e cuja empresa está contratando para a área, entende o problema
 * antes da primeira conversa — e é quem tem, como o André disse, mais propriedade para virar
 * cliente.
 *
 * Duas fontes:
 *  · **LinkedIn** — interações nos posts do André sobre IA (peso maior; é comportamento)
 *  · **Apollo** — cargo, vagas abertas e pilha tecnológica da empresa (peso menor; é contexto)
 *
 * Sem `server-only`: o cliente usa para explicar na tela POR QUE alguém está marcado como afim.
 */

/** Termos que indicam o tema, sem ambiguidade. Português e inglês — cargo e vaga vêm nos dois. */
const TERMOS_IA = [
  "inteligencia artificial", "artificial intelligence",
  "machine learning", "aprendizado de maquina", "deep learning", "data science",
  "ciencia de dados", "cientista de dados", "data scientist",
  "llm", "genai", "gen ai", "ia generativa", "generative ai", "chatgpt", "copilot", "claude",
  "automacao inteligente", "rpa", "chatbot", "assistente virtual",
  "mlops", "nlp", "computer vision", "visao computacional", "big data",
  "transformacao digital", "digital transformation",
];

/**
 * Padrões em que "IA"/"AI" aparece como o nosso assunto, e não como acaso.
 *
 * Foi um caso real que ensinou isto: "vi seu post sobre **agentes de IA** em processos comerciais"
 * — a frase mais claramente sobre o tema que existe — passava batido, porque "IA" solto só contava
 * junto de um qualificador de CARGO. A lista abaixo cobre como as pessoas realmente escrevem.
 */
const PADROES_IA = [
  /\bagentes?\s+de\s+ia\b/,
  /\b(sobre|com|de|em|usando|usar|adotar|implantar|aplicar)\s+ia\b/,
  /\bia\s+(aplicada|generativa|no|na|para|em|nos|nas)\b/,
  /\bai\s+(agents?|driven|powered|first|native)\b/,
  /\b(ferramentas?|projetos?|uso|adocao|estrategia|solucoes?|solucao)\s+de\s+ia\b/,
  /\bautomac(ao|oes)\s+(com|de|por)\s+ia\b/,
];

/** Cargos de dados — "dados" sozinho é ruído; junto do cargo, é o nosso público. */
const QUALIFICADOR_CARGO = /\b(head|lead|dir|diretor|gerente|manager|chief|especialista|analista|engenheiro|engineer|arquiteto|coordenador)\w*\s+(de\s+|do\s+|da\s+|em\s+|of\s+|in\s+)?(dados|data|ia|ai|analytics|automacao)\b/;

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Conta quantos sinais do tema aparecem num texto. Serve para cargo, vaga, descrição e mensagem.
 *
 * Cada família conta no máximo uma vez: um texto que repete "IA" dez vezes não é dez vezes mais
 * sobre IA que um que diz uma vez, e sem esse limite uma mensagem longa venceria uma curta e
 * precisa.
 */
export function mencoesDeIA(texto: string | null | undefined): number {
  if (!texto) return 0;
  const t = normalizar(texto);
  let n = 0;

  if (TERMOS_IA.some((termo) => t.includes(normalizar(termo)))) n++;
  if (PADROES_IA.some((re) => re.test(t))) n++;
  if (QUALIFICADOR_CARGO.test(t)) n++;
  // "IA" em maiúsculas, isolado, no texto ORIGINAL: em minúsculas "ia" é o verbo ir, mas ninguém
  // escreve "IA" por acaso.
  if (/\bIA\b/.test(texto)) n++;

  return n;
}

export type FontesAfinidade = {
  cargo?: string | null;
  vagas?: string[];
  tecnologias?: string[];
  descricaoEmpresa?: string | null;
  palavrasChaveEmpresa?: string[];
  interacoesLinkedIn?: { curtidas: number; comentarios: number; compartilhamentos: number };
};

export type Afinidade = { score: number; motivos: string[] };

/**
 * Calcula a afinidade 0–100 **e os motivos em português**.
 *
 * Os motivos não são enfeite: um número sozinho não diz a ninguém por que aquela pessoa está no
 * topo da lista, e quem for fazer a ligação precisa saber o que dizer. Um score de 70 com
 * "comentou 2 posts seus sobre IA" prepara a conversa; um 70 sozinho, não.
 */
export function calcularAfinidade(f: FontesAfinidade): Afinidade {
  const motivos: string[] = [];
  let s = 0;

  const li = f.interacoesLinkedIn;
  if (li) {
    if (li.compartilhamentos > 0) {
      s += Math.min(30, li.compartilhamentos * 30);
      motivos.push(`compartilhou ${li.compartilhamentos} post(s) seu(s) sobre IA`);
    }
    if (li.comentarios > 0) {
      s += Math.min(30, li.comentarios * 20);
      motivos.push(`comentou ${li.comentarios} post(s) seu(s) sobre IA`);
    }
    if (li.curtidas > 0) {
      s += Math.min(20, li.curtidas * 10);
      motivos.push(`curtiu ${li.curtidas} post(s) seu(s) sobre IA`);
    }
  }

  const noCargo = mencoesDeIA(f.cargo);
  if (noCargo > 0) { s += 18; motivos.push("o cargo dela é da área"); }

  const vagasIA = (f.vagas ?? []).filter((v) => mencoesDeIA(v) > 0);
  if (vagasIA.length > 0) {
    s += Math.min(18, vagasIA.length * 9);
    motivos.push(`a empresa está contratando para a área (${vagasIA.slice(0, 2).join(", ")})`);
  }

  const techIA = (f.tecnologias ?? []).filter((t) => mencoesDeIA(t) > 0);
  if (techIA.length > 0) {
    s += Math.min(12, techIA.length * 6);
    motivos.push(`a empresa já usa ${techIA.slice(0, 2).join(", ")}`);
  }

  const noPerfilEmpresa = mencoesDeIA(f.descricaoEmpresa) + (f.palavrasChaveEmpresa ?? []).filter((k) => mencoesDeIA(k) > 0).length;
  if (noPerfilEmpresa > 0) { s += 10; motivos.push("a empresa se descreve trabalhando com o tema"); }

  return { score: Math.max(0, Math.min(100, Math.round(s))), motivos };
}

/** Faixa legível — a tela mostra isto, não o número. */
export function faixaAfinidade(s: number): "dentro do assunto" | "em contato com o tema" | "sem sinal" {
  if (s >= 50) return "dentro do assunto";
  if (s >= 20) return "em contato com o tema";
  return "sem sinal";
}
