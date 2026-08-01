/**
 * Os blocos de um e-mail e como viram HTML.
 *
 * Módulo PURO — sem "server-only", sem banco, sem fetch. O editor precisa renderizar a prévia no
 * navegador enquanto a pessoa digita, e o disparo precisa gerar exatamente o mesmo HTML no
 * servidor. Se fossem dois renderizadores, a prévia mentiria — e ninguém descobre que a prévia
 * mente antes de o e-mail já ter saído para a lista inteira.
 *
 * ── Por que HTML de tabela com CSS inline ─────────────────────────────────────────────────────
 * Não é escolha estética. Outlook renderiza com o motor do Word: sem suporte a flexbox, grid,
 * `<style>` externo ou a maioria dos seletores. Tabela aninhada com estilo em cada elemento é o
 * único denominador comum que sobrevive de Gmail a Outlook 2016.
 */

export type Bloco =
  | { tipo: "titulo"; texto: string; nivel?: 1 | 2 }
  | { tipo: "texto"; texto: string }
  | { tipo: "botao"; label: string; url: string }
  | { tipo: "imagem"; url: string; alt?: string; link?: string }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "citacao"; texto: string; autor?: string }
  | { tipo: "divisor" }
  | { tipo: "espaco"; altura?: number };

export const BLOCOS_DISPONIVEIS: { tipo: Bloco["tipo"]; rotulo: string; descricao: string }[] = [
  { tipo: "titulo", rotulo: "Título", descricao: "Uma linha em destaque para abrir ou separar seções." },
  { tipo: "texto", rotulo: "Parágrafo", descricao: "O corpo da mensagem. Um assunto por parágrafo lê melhor." },
  { tipo: "botao", rotulo: "Botão", descricao: "A ação única do e-mail. Mais de um botão divide a atenção." },
  { tipo: "imagem", rotulo: "Imagem", descricao: "Precisa de URL pública. Muita gente lê com imagens desligadas — nunca ponha texto essencial dentro dela." },
  { tipo: "lista", rotulo: "Lista", descricao: "Itens curtos, para quem passa o olho." },
  { tipo: "citacao", rotulo: "Citação", descricao: "Fala de cliente ou frase de destaque." },
  { tipo: "divisor", rotulo: "Divisor", descricao: "Linha fina entre assuntos." },
  { tipo: "espaco", rotulo: "Espaço", descricao: "Respiro entre blocos." },
];

export function blocoVazio(tipo: Bloco["tipo"]): Bloco {
  switch (tipo) {
    case "titulo": return { tipo: "titulo", texto: "Um título curto", nivel: 2 };
    case "texto": return { tipo: "texto", texto: "Escreva aqui." };
    case "botao": return { tipo: "botao", label: "Quero saber mais", url: "https://salestrack.com.br" };
    case "imagem": return { tipo: "imagem", url: "", alt: "" };
    case "lista": return { tipo: "lista", itens: ["Primeiro item", "Segundo item"] };
    case "citacao": return { tipo: "citacao", texto: "O que o cliente disse.", autor: "Nome, cargo" };
    case "divisor": return { tipo: "divisor" };
    case "espaco": return { tipo: "espaco", altura: 24 };
  }
}

const CIANO = "#007A94", NAVY = "#1A1A2E", TINTA = "#26303A", FRACO = "#6B7A8D";
const FONTE = "font-family:'Montserrat',Arial,Helvetica,sans-serif;";

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/**
 * Variáveis do destinatário, resolvidas na hora do envio.
 *
 * `{{nome}}` sem valor vira o fallback depois do `|`, e não uma chave crua no meio da frase. "Olá,
 * {{nome}}!" chegando literalmente é o erro clássico de e-mail marketing — e é sempre visível para
 * o destinatário, nunca para quem enviou.
 */
export const VARIAVEIS = [
  { chave: "nome", rotulo: "Primeiro nome do contato", exemplo: "Ana" },
  { chave: "nome_completo", rotulo: "Nome completo", exemplo: "Ana Ribeiro" },
  { chave: "empresa", rotulo: "Empresa do contato", exemplo: "Acme" },
] as const;

export function resolverVariaveis(texto: string, dados: Record<string, string | null | undefined>): string {
  return texto.replace(/\{\{\s*(\w+)\s*(?:\|\s*([^}]*?))?\s*\}\}/g, (_m, chave: string, padrao?: string) => {
    const v = dados[chave];
    return (v && v.trim()) || (padrao ?? "").trim() || "";
  });
}

/** Toda variável usada nos blocos, para a tela poder avisar o que vai faltar. */
export function variaveisUsadas(blocos: Bloco[]): string[] {
  const achadas = new Set<string>();
  const varrer = (t: string) => { for (const m of t.matchAll(/\{\{\s*(\w+)/g)) achadas.add(m[1]); };
  for (const b of blocos) {
    if (b.tipo === "titulo" || b.tipo === "texto") varrer(b.texto);
    if (b.tipo === "citacao") { varrer(b.texto); varrer(b.autor ?? ""); }
    if (b.tipo === "botao") { varrer(b.label); varrer(b.url); }
    if (b.tipo === "lista") b.itens.forEach(varrer);
  }
  return [...achadas];
}

function renderBloco(b: Bloco): string {
  switch (b.tipo) {
    case "titulo": {
      const tam = b.nivel === 1 ? 26 : 20;
      return `<h${b.nivel ?? 2} style="margin:0 0 14px;${FONTE}font-size:${tam}px;font-weight:800;line-height:1.25;color:${NAVY};">${esc(b.texto)}</h${b.nivel ?? 2}>`;
    }
    case "texto":
      return `<p style="margin:0 0 16px;${FONTE}font-size:16px;line-height:1.6;color:${TINTA};">${esc(b.texto)}</p>`;
    case "botao":
      // Tabela em volta do link: é o que faz o botão ter área clicável no Outlook.
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="border-radius:10px;background:${CIANO};">
<a href="${esc(b.url)}" style="display:inline-block;padding:13px 26px;${FONTE}font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(b.label)}</a></td></tr></table>`;
    case "imagem": {
      if (!b.url) return "";
      const img = `<img src="${esc(b.url)}" alt="${esc(b.alt ?? "")}" width="536" style="width:100%;max-width:536px;height:auto;display:block;border:0;border-radius:10px;">`;
      return `<div style="margin:0 0 18px;">${b.link ? `<a href="${esc(b.link)}">${img}</a>` : img}</div>`;
    }
    case "lista":
      return `<ul style="margin:0 0 16px;padding-left:20px;">${b.itens.filter(Boolean).map((i) =>
        `<li style="margin:0 0 8px;${FONTE}font-size:16px;line-height:1.6;color:${TINTA};">${esc(i)}</li>`).join("")}</ul>`;
    case "citacao":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
<td style="border-left:3px solid ${CIANO};padding:4px 0 4px 16px;">
<p style="margin:0 0 6px;${FONTE}font-size:16px;line-height:1.6;font-style:italic;color:${TINTA};">${esc(b.texto)}</p>
${b.autor ? `<p style="margin:0;${FONTE}font-size:13px;color:${FRACO};">— ${esc(b.autor)}</p>` : ""}</td></tr></table>`;
    case "divisor":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="border-top:1px solid #E3E8EF;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
    case "espaco":
      return `<div style="height:${Math.min(80, Math.max(4, b.altura ?? 24))}px;line-height:0;font-size:0;">&nbsp;</div>`;
  }
}

export type RenderInput = {
  assunto: string;
  preheader?: string | null;
  blocos: Bloco[];
  remetente?: string | null;
  /** Link individual de descadastro. Sem ele o rodapé mostra endereço, nunca um link que não sai. */
  unsubscribeUrl?: string | null;
  /** Valores do destinatário para as variáveis. Vazio na prévia = mostra os exemplos. */
  dados?: Record<string, string | null | undefined>;
  endereco?: string | null;
};

/**
 * O e-mail inteiro, pronto para o Resend.
 *
 * O rodapé com a via de saída é montado por CÓDIGO e não é um bloco editável, de propósito: link de
 * descadastro é obrigação legal (art. 18) e não pode depender de alguém ter lembrado de arrastar o
 * bloco certo para o fim da campanha.
 */
export function renderEmail(input: RenderInput): string {
  const dados = input.dados ?? {};
  const resolver = (t: string) => resolverVariaveis(t, dados);
  const blocos = input.blocos.map((b): Bloco => {
    if (b.tipo === "titulo" || b.tipo === "texto") return { ...b, texto: resolver(b.texto) };
    if (b.tipo === "citacao") return { ...b, texto: resolver(b.texto), autor: b.autor ? resolver(b.autor) : undefined };
    if (b.tipo === "botao") return { ...b, label: resolver(b.label), url: resolver(b.url) };
    if (b.tipo === "lista") return { ...b, itens: b.itens.map(resolver) };
    return b;
  });

  const assunto = resolver(input.assunto);
  const corpo = blocos.map(renderBloco).join("\n");
  const saida = input.unsubscribeUrl
    ? `Não quer mais receber? <a href="${esc(input.unsubscribeUrl)}" style="color:${CIANO};text-decoration:underline;">Descadastrar</a>.`
    : `Para não receber mais, escreva para <a href="mailto:andre.kachan@salestrack.com.br" style="color:${CIANO};text-decoration:underline;">andre.kachan@salestrack.com.br</a>.`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assunto)}</title></head>
<body style="margin:0;padding:0;background:#EEF1F5;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(resolver(input.preheader ?? ""))}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(11,11,22,.08);">
<tr><td style="background:${NAVY};padding:22px 32px;border-bottom:3px solid ${CIANO};">
<span style="${FONTE}font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${CIANO};">Salestrack AI</span>
</td></tr>
<tr><td style="padding:32px;">
${corpo}
</td></tr>
<tr><td style="padding:20px 32px;background:${NAVY};">
<p style="margin:0 0 6px;${FONTE}font-size:11px;color:${FRACO};">Enviado por ${esc(input.remetente ?? "Salestrack AI")}${input.endereco ? ` para ${esc(input.endereco)}` : ""}.</p>
<p style="margin:0;${FONTE}font-size:11px;color:${FRACO};">${saida}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/**
 * Versão em texto puro. Vai junto no mesmo envio.
 *
 * Não é gentileza com quem lê em terminal: e-mail que chega só em HTML pontua pior nos filtros de
 * spam, e um `multipart/alternative` completo é dos ajustes mais baratos de entregabilidade.
 */
export function renderTexto(input: RenderInput): string {
  const dados = input.dados ?? {};
  const r = (t: string) => resolverVariaveis(t, dados);
  const linhas: string[] = [];
  for (const b of input.blocos) {
    if (b.tipo === "titulo") linhas.push(r(b.texto).toUpperCase(), "");
    else if (b.tipo === "texto") linhas.push(r(b.texto), "");
    else if (b.tipo === "botao") linhas.push(`${r(b.label)}: ${r(b.url)}`, "");
    else if (b.tipo === "lista") { for (const i of b.itens) linhas.push(`- ${r(i)}`); linhas.push(""); }
    else if (b.tipo === "citacao") linhas.push(`"${r(b.texto)}"${b.autor ? ` — ${r(b.autor)}` : ""}`, "");
    else if (b.tipo === "imagem" && b.alt) linhas.push(`[imagem: ${b.alt}]`, "");
    else if (b.tipo === "divisor") linhas.push("—".repeat(24), "");
  }
  linhas.push("", `Enviado por ${input.remetente ?? "Salestrack AI"}.`);
  linhas.push(input.unsubscribeUrl ? `Para não receber mais: ${input.unsubscribeUrl}` : "Para não receber mais, responda com \"sair\".");
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
