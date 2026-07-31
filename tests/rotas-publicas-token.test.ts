import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { propostaVencida } from "@/lib/proposta-validade";

/**
 * As sete rotas públicas do sistema — as que respondem sem sessão, só com um token na URL.
 *
 * O aceite de convite escondeu uma tomada de conta porque nunca tinha sido usado. Estas rotas estão
 * na mesma condição: ficam fora do matcher do middleware, várias nasceram em fases que nunca
 * rodaram, e cada uma libera algo real — um documento, uma decisão comercial, um formulário do
 * cliente. Este arquivo trava as regras que valem para todas.
 */

describe("validade da proposta", () => {
  const AGORA = new Date("2026-08-15T14:00:00-03:00");

  it("dentro do prazo, vale", () => {
    expect(propostaVencida("2026-08-20", AGORA)).toBe(false);
  });

  /**
   * O dia da validade conta INTEIRO. Quem recebe "válida até 15/08" entende que tem o dia 15 para
   * decidir; vencer à meia-noite que abre o dia 15 tiraria um dia que a proposta prometeu.
   */
  it("o último dia vale até o fim dele", () => {
    expect(propostaVencida("2026-08-15", AGORA)).toBe(false);
    expect(propostaVencida("2026-08-15", new Date("2026-08-15T23:59:00-03:00"))).toBe(false);
  });

  it("depois do último dia, não vale mais", () => {
    expect(propostaVencida("2026-08-14", AGORA)).toBe(true);
    expect(propostaVencida("2026-08-15", new Date("2026-08-16T00:01:00-03:00"))).toBe(true);
  });

  it("proposta sem prazo não vence", () => {
    expect(propostaVencida(null, AGORA)).toBe(false);
  });

  /**
   * A regra tem de ser a MESMA nos dois lugares. Quando morava só na página, a Server Action —
   * que é um endpoint — aceitava aprovar uma proposta vencida, e aprovar move o negócio para
   * fechamento e destrava o contrato.
   */
  it("a página e as ações importam a mesma função, não duas cópias da regra", () => {
    const pagina = readFileSync("app/p/[token]/page.tsx", "utf8");
    const acoes = readFileSync("app/p/[token]/actions.ts", "utf8");
    expect(pagina).toContain('from "@/lib/proposta-validade"');
    expect(acoes).toContain('from "@/lib/proposta-validade"');
    // nenhum dos dois pode reimplementar a comparação de data por conta própria
    expect(pagina).not.toMatch(/valid_until\s*\+\s*"T23:59/);
    expect(acoes).not.toMatch(/valid_until\s*\+\s*"T23:59/);
  });
});

/**
 * Nenhum token de rota pública pode nascer de `Math.random()` ou do relógio.
 *
 * O gerador do diagnóstico tinha um fallback `Date.now() + Math.random()` para o caso de
 * `crypto.randomUUID` não existir. No Node de hoje esse caminho nunca roda — o que é exatamente o
 * perigo: uma degradação silenciosa de credencial que ninguém veria acontecer.
 */
describe("como os tokens públicos nascem", () => {
  const GERADORES = [
    "lib/diagnostico.ts",
    "lib/studio/engine.ts",
    "lib/deliverables/service.ts",
    "app/portal/equipe/actions.ts",
  ];

  it.each(GERADORES)("%s não usa Math.random nem o relógio para gerar token", (arquivo) => {
    if (!existsSync(arquivo)) return;
    const src = readFileSync(arquivo, "utf8");
    const linhasDeToken = src.split("\n").filter((l) => /token/i.test(l) && !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"));
    for (const l of linhasDeToken) {
      expect(l, `${arquivo}: token derivado de fonte previsível`).not.toMatch(/Math\.random|Date\.now\(\)/);
    }
  });
});

/**
 * O middleware é enxuto de propósito — rota pública não paga ida ao Supabase Auth. O risco é o
 * inverso do óbvio: alguém criar uma rota nova sob /admin ou /portal achando que está coberta.
 */
describe("o matcher do middleware", () => {
  it("cobre admin, portal e login — e nada mais", () => {
    const mw = readFileSync("middleware.ts", "utf8");
    const m = mw.match(/matcher:\s*\[([^\]]+)\]/);
    expect(m, "matcher não encontrado").toBeTruthy();
    const rotas = m![1].split(",").map((s) => s.trim().replace(/["']/g, "")).filter(Boolean);
    expect(rotas.sort()).toEqual(["/admin/:path*", "/login", "/portal/:path*"]);
  });
});
