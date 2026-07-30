/**
 * Tipos dos blocos de aula da Academy.
 *
 * O conteúdo da trilha é gravado em academy_lessons.corpo EXATAMENTE como veio da fonte,
 * com os nomes de campo originais. Isso torna a migração uma cópia verificável por igualdade,
 * e não uma reinterpretação — a razão de existir do teste de conteúdo.
 *
 * academy_lessons.tipo NÃO tem check constraint no banco, de propósito: são 19 formas hoje e
 * conteúdo novo inventa mais. Precedente da casa: studio_deliverables.kind tem 31 valores e
 * nenhum check; a validação vive em TypeScript. Aqui é este arquivo.
 *
 * Sem "server-only": também é consumido por componentes de cliente.
 */

export type Bloco =
  // conceito e mcp trazem HTML embutido (<strong>, <em>) — precisam de sanitização ao renderizar
  | { tipo: "conceito" | "mcp"; titulo: string; conteudo: string }
  | { tipo: "comparativo"; titulo: string; linhas: string[][] }
  | { tipo: "exemplo"; titulo: string; passos: { acao: string; desc: string }[] }
  | { tipo: "quando"; titulo: string; usar: string[]; nao_usar: string[] }
  | { tipo: "tarefa" | "checklist_tools"; titulo: string; itens: string[] }
  | { tipo: "seis_elementos"; titulo: string; elementos: { num: string; titulo: string; pergunta: string; exemplo: string; erro: string }[] }
  | { tipo: "template"; titulo: string; campos: { label: string; placeholder: string }[] }
  | { tipo: "estrutura"; titulo: string; secoes: { tag: string; desc: string; exemplo: string; dica: string }[] }
  | { tipo: "bom_ruim"; titulo: string; comparacoes: { label: string; ruim: string; bom: string }[] }
  | { tipo: "testes"; titulo: string; testes: { nome: string; desc: string; exemplo: string }[] }
  | { tipo: "anatomia"; titulo: string; campos: { campo: string; desc: string; ex: string }[] }
  | { tipo: "json_exemplo"; titulo: string; json: string }
  | { tipo: "riscos"; titulo: string; itens: { risco: string; nivel: string; desc: string; exemplo: string; mitigacao: string }[] }
  | { tipo: "governanca"; titulo: string; perguntas: { q: string; desc: string }[] }
  | { tipo: "formula"; titulo: string; blocos: { label: string; formula: string; ex: string }[] }
  | { tipo: "ciclo"; titulo: string; etapas: { num: string; titulo: string; desc: string; freq: string }[] }
  | { tipo: "apresentacao"; titulo: string; topicos: { titulo: string; desc: string }[] };

export type TipoBloco = Bloco["tipo"];

/**
 * Os 19 tipos existentes na trilha importada.
 * O teste de conteúdo confere que todo tipo presente na fonte tem renderizador registrado —
 * é o que impede sumir em silêncio com `mcp`, `formula` ou `apresentacao`, que têm
 * uma única instância cada.
 */
export const TIPOS_BLOCO: TipoBloco[] = [
  "conceito", "comparativo", "exemplo", "quando", "tarefa", "seis_elementos", "template",
  "estrutura", "bom_ruim", "testes", "anatomia", "json_exemplo", "checklist_tools", "mcp",
  "riscos", "governanca", "formula", "ciclo", "apresentacao",
];

/** Valida o formato mínimo na escrita (a importação usa isto antes de gravar). */
export function blocoValido(b: unknown): b is Bloco {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return typeof o.tipo === "string" && typeof o.titulo === "string";
}

/** Nível de risco → cor semântica, usado pelo bloco `riscos`. */
export function corDoNivel(nivel: string): string {
  const n = nivel.toUpperCase();
  if (n === "ALTO") return "var(--danger, #DC2626)";
  if (n === "MEDIO" || n === "MÉDIO") return "var(--warn, #D97706)";
  return "var(--fg-3)";
}
