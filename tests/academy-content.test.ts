/**
 * Prova de que a trilha da Academy foi migrada sem perda.
 *
 * Duas camadas:
 *  1. Sempre: o pacote semeado (supabase/seed/academy_trilha.json, versionado) tem as contagens
 *     e os tipos certos, e TODO tipo presente tem renderizador registrado. Isso continua valendo
 *     depois que o repositório antigo da academy for apagado no Bloco 8.
 *  2. Quando a fonte ainda existe: o pacote é idêntico ao que se extrai do HTML original,
 *     comparando todas as folhas de texto. É a asserção de "nada se perdeu".
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { TIPOS_COM_RENDERIZADOR } from "@/components/academy/Blocos";

const PACOTE = path.join(process.cwd(), "supabase", "seed", "academy_trilha.json");
/**
 * A fonte original vive DENTRO do repositório desde 2026-07-30.
 * Antes apontava para ~/salestrack-ai-academy, que foi apagado no desligamento da academy
 * antiga — e o teste de igualdade passou a ser pulado em silêncio, que é o pior resultado
 * possível para a asserção mais importante do arquivo. Preservada em docs/, ela roda sempre.
 */
const FONTE = path.join(process.cwd(), "docs", "desligamento-academy", "academy-fonte-original.html");

type Licao = { ordem: number; tipo: string; titulo: string; corpo: Record<string, unknown> };
type Modulo = { ordem: number; titulo: string; licoes: Licao[]; tarefas: { ordem: number; texto: string }[] };
type Pacote = { curso: { slug: string }; modulos: Modulo[]; referencias: Record<string, unknown[]> };

const pacote: Pacote = JSON.parse(fs.readFileSync(PACOTE, "utf8"));
const licoes = pacote.modulos.flatMap((m) => m.licoes);
const tarefas = pacote.modulos.flatMap((m) => m.tarefas);

/**
 * Concatena toda folha de texto, em ordem — a impressão digital do conteúdo.
 *
 * Aplica a MESMA anonimização da importação: nome de cliente real não vira exemplo de material
 * didático. Sem isso a comparação acusaria divergência onde a diferença é intencional — e a
 * alternativa (afrouxar a asserção) destruiria o valor do teste.
 */
function folhas(v: unknown, saida: string[] = []): string[] {
  if (typeof v === "string") saida.push(v.replace(/Nouryon/g, "[nome da empresa]").replace(/\s+/g, " ").trim());
  else if (Array.isArray(v)) v.forEach((x) => folhas(x, saida));
  else if (v && typeof v === "object") Object.keys(v).sort().forEach((k) => folhas((v as Record<string, unknown>)[k], saida));
  return saida;
}

describe("Academy · conteúdo migrado", () => {
  it("tem 6 módulos, 32 aulas e 17 tarefas", () => {
    expect(pacote.modulos).toHaveLength(6);
    expect(licoes).toHaveLength(32);
    expect(tarefas).toHaveLength(17);
  });

  it("tem 24 prompts, 28 ferramentas, 20 termos e 15 itens de checklist", () => {
    expect(pacote.referencias.prompts).toHaveLength(24);
    expect(pacote.referencias.tools).toHaveLength(28);
    expect(pacote.referencias.glossario).toHaveLength(20);
    expect(pacote.referencias.checklist).toHaveLength(15);
  });

  // Esta é a asserção que impede sumir em silêncio com os blocos de instância única
  // (mcp, formula, apresentacao, json_exemplo...). Sem ela, um tipo esquecido cairia
  // no BlocoDesconhecido em produção e ninguém perceberia.
  it("os 19 tipos existem e TODOS têm renderizador registrado", () => {
    const tipos = [...new Set(licoes.map((l) => l.tipo))];
    expect(tipos).toHaveLength(19);
    const semRenderizador = tipos.filter((t) => !(TIPOS_COM_RENDERIZADOR as readonly string[]).includes(t));
    expect(semRenderizador, `tipos sem renderizador: ${semRenderizador.join(", ")}`).toEqual([]);
  });

  it("ordens são contíguas e começam em 0 dentro de cada módulo", () => {
    expect(pacote.modulos.map((m) => m.ordem)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const m of pacote.modulos) {
      expect(m.licoes.map((l) => l.ordem), `aulas do módulo ${m.ordem}`).toEqual(m.licoes.map((_, i) => i));
      expect(m.tarefas.map((t) => t.ordem), `tarefas do módulo ${m.ordem}`).toEqual(m.tarefas.map((_, i) => i));
    }
  });

  it("nenhum nome de cliente real aparece no material", () => {
    const tudo = JSON.stringify(pacote);
    expect(tudo, "nome de cliente real vazou para o conteúdo didático").not.toContain("Nouryon");
    expect(tudo).toContain("[nome da empresa]");
  });

  it("nenhuma aula está vazia", () => {
    for (const l of licoes) {
      expect(l.titulo.trim().length, `aula ${l.tipo} sem título`).toBeGreaterThan(0);
      expect(Object.keys(l.corpo).length, `aula "${l.titulo}" sem corpo`).toBeGreaterThan(0);
    }
  });

  // A contagem de tarefas por módulo vem de TRILHA, não de MODS. A fonte tinha as duas
  // divergindo (MODS dizia 2 onde TRILHA tem 3, nos módulos 2 a 5), e era isso que fazia a
  // academy antiga marcar módulo como concluído cedo demais.
  it("as tarefas por módulo seguem TRILHA (2,3,3,3,3,3), não a contagem divergente de MODS", () => {
    expect(pacote.modulos.map((m) => m.tarefas.length)).toEqual([2, 3, 3, 3, 3, 3]);
  });

  it("é idêntico à fonte original, folha a folha", () => {
    expect(fs.existsSync(FONTE),
      "a fonte original precisa estar em docs/desligamento-academy/ — sem ela esta garantia morre").toBe(true);
    const src = fs.readFileSync(FONTE, "utf8");
    const re = /(?:const|let|var)\s+TRILHA\s*=\s*\[/;
    const m = re.exec(src)!;
    const abre = src.indexOf("[", m.index);
    let d = 0, aspas: string | null = null, esc = false, fim = -1;
    for (let p = abre; p < src.length; p++) {
      const ch = src[p];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (aspas) { if (ch === aspas) aspas = null; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { aspas = ch; continue; }
      if (ch === "[") d++;
      else if (ch === "]" && --d === 0) { fim = p; break; }
    }
    const TRILHA = vm.runInNewContext("(" + src.slice(abre, fim + 1) + ")") as {
      sections?: Record<string, unknown>[]; tasks?: string[];
    }[];

    const daFonte = folhas(TRILHA.map((mo) => ({ s: mo.sections ?? [], t: mo.tasks ?? [] })));
    const doPacote = folhas(pacote.modulos.map((mo) => ({
      s: mo.licoes.map((l) => ({ tipo: l.tipo, titulo: l.titulo, ...l.corpo })),
      t: mo.tarefas.map((t) => t.texto),
    })));
    expect(doPacote, "o conteúdo semeado divergiu da fonte").toEqual(daFonte);
  });
});
