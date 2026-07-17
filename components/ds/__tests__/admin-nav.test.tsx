import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { areaForPath, isV5Path, AREAS } from "@/lib/admin/nav";
import { PageHeader } from "@/components/ds";

describe("IA das áreas do admin", () => {
  it("tem 4 destinos por jornada (U5)", () => {
    expect(AREAS.map((a) => a.key)).toEqual(["jornadas", "comercial", "estudio", "config"]);
  });
  it("resolve o destino ativo das rotas legadas re-hospedadas", () => {
    expect(areaForPath("/admin/crm")).toBe("comercial");
    expect(areaForPath("/admin/crm/123")).toBe("comercial");
    expect(areaForPath("/admin/programas")).toBe("jornadas");
    expect(areaForPath("/admin/clientes")).toBe("jornadas");
    expect(areaForPath("/admin/relacionamento")).toBe("jornadas");
    expect(areaForPath("/admin/entregaveis")).toBe("estudio");
    expect(areaForPath("/admin/estudio")).toBe("estudio");        // Estúdio do Método → Estúdio
    expect(areaForPath("/admin/comunicacao")).toBe("estudio");
    expect(areaForPath("/admin/configuracoes")).toBe("config");
    expect(areaForPath("/admin/financeiro")).toBe("jornadas");    // Financeiro do cliente → Jornadas
    expect(areaForPath("/admin")).toBe("jornadas");               // landing → Hoje (destaque Jornadas)
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
