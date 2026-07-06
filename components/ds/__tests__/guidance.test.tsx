import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { helpFor, HELP, allGuides, searchGuides } from "@/lib/guidance/registry";
import { EmptyState } from "@/components/ds";

describe("Registro de ajuda 'Como usar'", () => {
  it("retorna conteúdo para rotas cobertas e null para rota sem entrada", () => {
    const h = helpFor("/admin/hoje");
    expect(h).not.toBeNull();
    expect(h!.passos.length).toBeGreaterThan(0);
    expect(helpFor("/admin/rota-inexistente")).toBeNull();
  });
  it("cobre as 6 áreas do admin e as 5 telas do portal", () => {
    const keys = Object.keys(HELP);
    for (const k of ["/admin/hoje", "/admin/clientes", "/admin/comercial", "/admin/estudio-area", "/admin/metodo", "/admin/plataforma"]) expect(keys).toContain(k);
    for (const k of ["/portal", "/portal/visao", "/portal/copilotos", "/portal/automacoes", "/portal/config"]) expect(keys).toContain(k);
  });
  it("R5.2 · nenhum guia usa códigos internos (R3.x/R4.x) nem jargão de plataforma", () => {
    for (const h of Object.values(HELP)) {
      const txt = `${h.titulo} ${h.oQueE} ${h.passos.join(" ")} ${h.dica ?? ""}`;
      expect(txt).not.toMatch(/\bR[34]\.\d/);           // sem "R4.3", "R3.4"…
      expect(txt.toLowerCase()).not.toContain("orquestraç");
      expect(txt.toLowerCase()).not.toContain("elegível para");
    }
  });
  it("todo conteúdo tem título, o-que-é e passos (nada vazio)", () => {
    for (const h of Object.values(HELP)) {
      expect(h.titulo.length).toBeGreaterThan(0);
      expect(h.oQueE.length).toBeGreaterThan(0);
      expect(h.passos.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("R5.1 · cobre Estúdio, Comunicação e subtelas do portal", () => {
    const keys = Object.keys(HELP);
    for (const k of ["/admin/entregaveis", "/admin/comunicacao", "/admin/entregaveis/identidade", "/portal/consultor", "/portal/playbook", "/portal/roi"]) expect(keys).toContain(k);
  });
});

describe("R5.1 · Hub de ajuda buscável", () => {
  it("allGuides deriva a superfície da rota", () => {
    const g = allGuides();
    expect(g.length).toBeGreaterThan(20);
    expect(g.find((x) => x.href === "/portal/consultor")!.surface).toBe("portal");
    expect(g.find((x) => x.href === "/admin/entregaveis")!.surface).toBe("admin");
  });
  it("searchGuides filtra por termo e superfície (ignora acentos)", () => {
    const regua = searchGuides("regua", "admin");
    expect(regua.some((g) => g.href === "/admin/comunicacao")).toBe(true);
    const port = searchGuides("resultados", "portal");
    expect(port.every((g) => g.surface === "portal")).toBe(true);
    expect(searchGuides("", "admin").length).toBe(allGuides().filter((g) => g.surface === "admin").length);
    expect(searchGuides("zzznadaaqui").length).toBe(0);
  });
  it("EmptyState mostra ‘Ver o guia’ quando guiaHref é passado (e omite sem)", () => {
    const { unmount } = render(<EmptyState title="Vazio" guiaHref="/admin/ajuda" />);
    const link = screen.getByText("Ver o guia →");
    expect(link).toHaveAttribute("href", "/admin/ajuda");
    unmount();
    render(<EmptyState title="Vazio 2" />);
    expect(screen.queryByText("Ver o guia →")).toBeNull();
  });
});
