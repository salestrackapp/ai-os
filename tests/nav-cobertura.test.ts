import { describe, it, expect } from "vitest";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AREAS } from "@/lib/admin/nav";

/**
 * REGRA DA CASA (André, 2026-07-30): **tudo que é construído tem que estar acessível em algum
 * lugar.** Uma tela que só existe por URL direta é uma tela que ninguém usa.
 *
 * Este teste percorre `app/admin` e cobra que cada página apareça no menu. Ele existe porque o
 * problema já aconteceu: sete telas construídas num dia — escopo e entregas, buscas automáticas,
 * sinais do LinkedIn, coleta externa, mensagens, LGPD — ficaram invisíveis, e a Academy inteira
 * estava enterrada dentro do Estúdio.
 *
 * Isenções: rotas dinâmicas (`[id]`), sub-ações alcançadas por botão da tela pai (`/novo`,
 * `/nova`, `/importar`) e o cockpit. Tudo o mais precisa de porta.
 */

const RAIZ = join(process.cwd(), "app", "admin");

const ISENTAS = new Set([
  "/admin/hoje",       // cockpit, alcançado pelo logo e pelo atalho
  "/admin/dashboard",  // painel antigo, acessível por dentro do Hoje
]);

/** Sub-ação: existe atrás de um botão da tela pai, não merece linha própria no menu. */
function ehSubAcao(rota: string): boolean {
  return /\/(novo|nova|new|editar|importar)$/.test(rota);
}

/**
 * Alias: a rota existe, mas leva a outro lugar (redireciona) ou só repete o índice de um destino.
 * Detectado pelo conteúdo, não por lista fixa — lista fixa envelhece e volta a esconder telas.
 */
function ehAlias(caminhoDaPagina: string): boolean {
  const fonte = readFileSync(caminhoDaPagina, "utf8");
  return /\bredirect\(/.test(fonte) || /<AreaIndex\b/.test(fonte);
}

/**
 * Devolve as rotas do admin. `soProprias` exclui aliases — úteis como destino de menu (o índice de
 * cada área é um), mas que não precisam de linha própria porque não são tela nova.
 */
function rotas(dir: string, base = "/admin", soProprias = false): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (!statSync(caminho).isDirectory()) continue;
    if (nome.startsWith("[")) continue;                 // rota dinâmica: alcançada por link de lista
    const rota = `${base}/${nome}`;
    const pagina = join(caminho, "page.tsx");
    try {
      statSync(pagina);
      if (!soProprias || !ehAlias(pagina)) saida.push(rota);
    } catch { /* pasta sem página própria, só agrupa filhos */ }
    saida.push(...rotas(caminho, rota, soProprias));
  }
  return saida;
}

describe("Cobertura do menu do admin", () => {
  const noMenu = new Set(AREAS.flatMap((a) => [a.href, ...a.sections.map((s) => s.href)]));

  it("toda tela do admin tem porta de entrada no menu", () => {
    const orfas = rotas(RAIZ, "/admin", true)
      .filter((r) => !ISENTAS.has(r) && !ehSubAcao(r) && !noMenu.has(r));
    expect(orfas, `Sem acesso pelo menu:\n  ${orfas.join("\n  ")}`).toEqual([]);
  });

  it("nenhum item do menu aponta para tela que não existe", () => {
    const existentes = new Set(rotas(RAIZ));
    const quebrados = [...noMenu]
      .filter((h) => h.startsWith("/admin/"))
      .map((h) => h.split("?")[0])
      .filter((h) => !existentes.has(h) && h !== "/admin/hoje" && h !== "/admin");
    expect(quebrados, `Menu aponta para tela inexistente:\n  ${quebrados.join("\n  ")}`).toEqual([]);
  });

  it("cada destino tem ao menos uma subseção — menu vazio não ajuda ninguém", () => {
    for (const a of AREAS) {
      expect(a.sections.length, `O destino "${a.label}" não tem subseções`).toBeGreaterThan(0);
    }
  });
});
