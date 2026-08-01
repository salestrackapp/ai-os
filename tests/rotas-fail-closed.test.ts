import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Toda rota de máquina para máquina para quando o segredo dela não está configurado.
 *
 * ── A regra, e de onde ela vem ────────────────────────────────────────────────────────────────
 * `/api/leads/novo` carrega no comentário a história: `/api/cron/orchestrate` já teve uma guarda
 * `if (secret && chave !== secret)` — que, sem a env definida, deixava a rota passar livre. A casa
 * decidiu o contrário: sem segredo, a rota PARA.
 *
 * O webhook do WhatsApp tinha voltado a violar isso. Este teste existe para que a próxima violação
 * seja pega no CI e não numa auditoria — a guarda fail-open é fácil de escrever por acidente,
 * porque parece defensiva.
 */

function rotas(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return rotas(p);
    return e.name === "route.ts" ? [p] : [];
  });
}

/**
 * Rotas que respondem a máquinas: cron e webhook. As de sessão (`currentMembership`,
 * `resolvePortalOrg`) e as de token público por linha (`/api/e/[token]`, `/api/p/[token]`) seguem
 * outro padrão e são auditadas em `rotas-publicas-token.test.ts`.
 */
const MAQUINA = rotas("app/api").filter((p) =>
  /\/(cron|webhook|events)\//.test(p)
  || /\/webhook\/route\.ts$/.test(p)
  || /leads\/novo/.test(p)
  // Recebe dos sites institucionais com o mesmo segredo dos leads — é rota de máquina como as outras.
  || /api\/inscrever\/route\.ts$/.test(p));

describe("rotas de máquina são fail-closed", () => {
  it("o levantamento encontrou as rotas — um filtro que não casa nada passaria vazio", () => {
    expect(MAQUINA.length).toBeGreaterThanOrEqual(15);
  });

  /**
   * Comentários são removidos antes da varredura — sem isso, a documentação de um padrão ruim
   * ("a guarda anterior era `if (expected && ...)`") acusa o arquivo que o corrigiu. Foi o primeiro
   * resultado deste teste, e um teste que pune quem explica o defeito não sobrevive a ninguém.
   */
  const semComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it.each(MAQUINA)("%s recusa quando o segredo não está configurado", (arquivo) => {
    const src = semComentarios(readFileSync(arquivo, "utf8"));

    /**
     * A assinatura da falha: uma condição que só bloqueia SE o segredo existir. Em
     * `if (expected && key !== expected)`, a ausência de `expected` faz a expressão inteira ser
     * falsa — e a requisição segue. É o oposto do que a guarda aparenta fazer.
     */
    const failOpen = /if\s*\(\s*(\w+)\s*&&\s*[\w.()]+\s*!==\s*\1\s*\)/.test(src)
      || /if\s*\(\s*(\w+)\s*&&\s*\1\s*!==\s*[\w.()]+\s*\)/.test(src);
    expect(failOpen, `${arquivo}: guarda passa livre quando o segredo não está definido`).toBe(false);

    /**
     * E precisa existir uma recusa para o caso "sem segredo". Três formas contam:
     * a checagem separada (`if (!secret) return 503`), a combinada (`if (!secret || x !== secret)`)
     * e a verificação de assinatura, que falha sozinha quando não há chave para conferir.
     */
    const recusaSemSegredo = /if\s*\(\s*!\w+/.test(src)
      || /(503|not_configured|degraded:\s*true|invalid signature|verifySlackSignature|validStripeSig)/.test(src);
    expect(recusaSemSegredo, `${arquivo}: nenhuma recusa para o caso de segredo ausente`).toBe(true);
  });
});
