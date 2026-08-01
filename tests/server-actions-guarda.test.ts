import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Toda Server Action do admin prova quem está chamando.
 *
 * ── Por que isto é um teste, e não uma convenção escrita ──────────────────────────────────────
 * Qualquer função async exportada de um arquivo `"use server"` é um endpoint POST. A página que a
 * renderiza não protege nada: quem tiver o identificador da action a chama direto, sem nunca abrir
 * a tela. A regra "toda action sensível tem guarda local" já estava escrita no plano do projeto —
 * e, quando fui conferir, 32 actions em 9 arquivos não a seguiam. Regra escrita não se cumpre
 * sozinha; regra testada, sim.
 *
 * ── A RLS não é a resposta ────────────────────────────────────────────────────────────────────
 * Aquelas 32 estavam de fato protegidas: escrever nas tabelas delas exige `is_salestrack_admin()`
 * no banco. Mas isso deixa cada action refém de uma política que alguém pode afrouxar por outro
 * motivo. As duas camadas existem para que afrouxar uma não abra a outra.
 */

function arquivos(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Qualquer coisa que resolva a identidade de quem chama, incluindo as guardas próprias de área. */
const GUARDA = /currentMembership|exigirAdmin|requireAdmin|requireTeam|isSalestrackAdmin|exigirRh|resolvePortalOrg|resolveLearner|canManage/;

const ACTIONS_ADMIN = arquivos("app/admin")
  .filter((p) => /^\s*["']use server["']/m.test(readFileSync(p, "utf8")))
  .filter((p) => /export\s+async\s+function/.test(readFileSync(p, "utf8")));

describe("Server Actions do admin", () => {
  it("o levantamento encontrou os arquivos — um filtro furado passaria vazio", () => {
    expect(ACTIONS_ADMIN.length).toBeGreaterThanOrEqual(25);
  });

  it.each(ACTIONS_ADMIN)("%s prova quem está chamando", (arquivo) => {
    const src = readFileSync(arquivo, "utf8");
    expect(GUARDA.test(src), `${arquivo}: nenhuma verificação de identidade — a action é chamável por qualquer usuário autenticado`).toBe(true);
  });
});

/**
 * As rotas públicas com Server Action seguem outra regra: não há sessão, e a credencial é o TOKEN
 * da URL. O que elas precisam provar é que o token corresponde ao recurso — e não confiar no id
 * que veio junto no corpo da requisição, que quem chama escolhe.
 */
describe("Server Actions públicas validam o token", () => {
  const PUBLICAS = [
    "app/p/[token]/actions.ts",
    "app/entregavel/[token]/actions.ts",
    "app/diagnostico/[token]/actions.ts",
  ].filter(existsSync);

  it("o levantamento encontrou as rotas públicas", () => {
    expect(PUBLICAS.length).toBeGreaterThanOrEqual(2);
  });

  it.each(PUBLICAS)("%s carrega o recurso PELO token, não pelo id recebido", (arquivo) => {
    const src = readFileSync(arquivo, "utf8");
    // Alguma consulta tem de casar uma coluna de token com o valor recebido.
    expect(
      /eq\(\s*["'](access_token|public_token|token)["']\s*,\s*token\s*\)/.test(src)
      // Ou delega para uma função cujo nome diz que a busca é PELO token.
      || /\b(getIntakeByToken|saveIntakeByToken|loadOpen)\s*\(\s*token\b/.test(src),
      `${arquivo}: nada amarra o token ao recurso`,
    ).toBe(true);
  });
});
