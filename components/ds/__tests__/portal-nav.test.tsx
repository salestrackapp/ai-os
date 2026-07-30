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
  it("TODA tela do portal usa a casca do DS — o frame legado não existe mais", () => {
    // Antes só os 3 destinos eram v5, e as outras 15 telas passavam pelo PortalLegacyFrame
    // (que dava o padding). Agora cada tela traz o próprio <ContentArea>, então o frame saiu.
    for (const r of ["/portal", "/portal/entregaveis", "/portal/conta", "/portal/roi",
                     "/portal/playbook/como-vender", "/portal/equipe", "/portal/sessoes"]) {
      expect(isV5PortalPath(r), `${r} deveria renderizar na casca do DS`).toBe(true);
    }
  });
});
