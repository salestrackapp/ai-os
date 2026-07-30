import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { areaForPath, isV5Path, AREAS } from "@/lib/admin/nav";
import { PageHeader } from "@/components/ds";

describe("IA das áreas do admin", () => {
  it("tem 7 destinos por jornada", () => {
    // Marketing e Academy viraram destinos próprios em 2026-07-30: dentro de Comercial e do
    // Estúdio, respectivamente, ninguém as encontrava.
    expect(AREAS.map((a) => a.key)).toEqual(
      ["jornadas", "comercial", "marketing", "academy", "estudio", "rh", "config"]);
  });
  it("resolve o destino ativo das rotas legadas re-hospedadas", () => {
    expect(areaForPath("/admin/crm")).toBe("comercial");
    expect(areaForPath("/admin/crm/123")).toBe("comercial");
    expect(areaForPath("/admin/programas")).toBe("jornadas");
    expect(areaForPath("/admin/clientes")).toBe("jornadas");
    expect(areaForPath("/admin/relacionamento")).toBe("marketing");
    expect(areaForPath("/admin/marketing")).toBe("marketing");
    expect(areaForPath("/admin/academy/prova")).toBe("academy");
    expect(areaForPath("/admin/entregas")).toBe("jornadas");
    expect(areaForPath("/admin/lgpd")).toBe("config");
    expect(areaForPath("/admin/rh")).toBe("rh");
    expect(areaForPath("/admin/entregaveis")).toBe("estudio");
    expect(areaForPath("/admin/estudio")).toBe("estudio");        // Estúdio do Método → Estúdio
    expect(areaForPath("/admin/comunicacao")).toBe("marketing");
    expect(areaForPath("/admin/configuracoes")).toBe("config");
    expect(areaForPath("/admin/financeiro")).toBe("jornadas");    // Financeiro do cliente → Jornadas
    expect(areaForPath("/admin")).toBe("jornadas");               // landing → Hoje (destaque Jornadas)
  });
  it("TODA tela do admin usa a casca do DS — o frame legado não existe mais", () => {
    // Antes só ~24 rotas eram v5 e as outras 42 passavam pelo LegacyFrame (que dava o padding).
    // Agora cada tela traz o próprio <ContentArea>, então o frame saiu.
    for (const r of ["/admin/hoje", "/admin/comercial", "/admin/crm", "/admin/dashboard",
                     "/admin/configuracoes/equipe", "/admin/prospeccao/cadencias"]) {
      expect(isV5Path(r), `${r} deveria renderizar na casca do DS`).toBe(true);
    }
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
