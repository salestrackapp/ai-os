import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { PORTAL_AREAS, areaForPortalPath, isV5PortalPath } from "@/lib/portal/nav";

describe("IA do portal (U4 · 3 destinos)", () => {
  it("tem 3 destinos: Minha Jornada · Entregas · Conta", () => {
    expect(PORTAL_AREAS.map((a) => a.key)).toEqual(["jornada", "entregas", "conta"]);
  });
  it("mapeia as rotas para o destino certo", () => {
    expect(areaForPortalPath("/portal")).toBe("jornada");
    expect(areaForPortalPath("/portal/entregaveis")).toBe("entregas");
    expect(areaForPortalPath("/portal/conta")).toBe("conta");
    expect(areaForPortalPath("/portal/financeiro")).toBe("conta");
    expect(areaForPortalPath("/portal/governanca")).toBe("conta");
    // avançadas reveladas na home destacam "Minha Jornada"
    expect(areaForPortalPath("/portal/roi")).toBe("jornada");
    expect(areaForPortalPath("/portal/consultor")).toBe("jornada");
  });
  it("os 3 destinos são v5 (claros)", () => {
    expect(isV5PortalPath("/portal")).toBe(true);
    expect(isV5PortalPath("/portal/entregaveis")).toBe(true);
    expect(isV5PortalPath("/portal/conta")).toBe(true);
    expect(isV5PortalPath("/portal/roi")).toBe(false);
  });
});
