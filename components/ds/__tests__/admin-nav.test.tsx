import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { areaForPath, isV5Path, AREAS } from "@/lib/admin/nav";
import { PageHeader } from "@/components/ds";

describe("IA das áreas do admin", () => {
  it("tem as áreas na ordem correta (incl. Relacionamento, série E)", () => {
    expect(AREAS.map((a) => a.key)).toEqual(["hoje", "clientes", "comercial", "relacionamento", "estudio", "metodo", "plataforma"]);
  });
  it("resolve a área ativa de rotas legadas re-hospedadas", () => {
    expect(areaForPath("/admin/crm")).toBe("comercial");
    expect(areaForPath("/admin/crm/123")).toBe("comercial");
    expect(areaForPath("/admin/programas")).toBe("clientes");
    expect(areaForPath("/admin/entregaveis")).toBe("estudio");
    expect(areaForPath("/admin/relacionamento")).toBe("relacionamento");
    expect(areaForPath("/admin/estudio")).toBe("metodo");        // Estúdio do Método → Método
    expect(areaForPath("/admin/configuracoes")).toBe("plataforma");
    expect(areaForPath("/admin")).toBe("hoje");
  });
  it("distingue páginas v5 (claras) de legadas (frame escuro)", () => {
    expect(isV5Path("/admin/hoje")).toBe(true);
    expect(isV5Path("/admin/comercial")).toBe(true);
    expect(isV5Path("/admin/crm")).toBe(false);
  });
});

describe("PageHeader", () => {
  it("renderiza eyebrow, título e os slots actions/configurar/comoUsar", () => {
    render(<PageHeader eyebrow="Comercial" title="Comercial" subtitle="Funil"
      actions={<button>Nova proposta</button>} configurar={<span>Configurar</span>} comoUsar={<span>Como usar</span>} />);
    expect(screen.getByText("Comercial", { selector: "h1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova proposta" })).toBeInTheDocument();
    expect(screen.getByText("Configurar")).toBeInTheDocument();
    expect(screen.getByText("Como usar")).toBeInTheDocument();
  });
});
