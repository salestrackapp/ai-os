import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { PORTAL_AREAS, areaForPortalPath, isV5PortalPath } from "@/lib/portal/nav";

describe("IA do portal (kit ai-operating-system)", () => {
  it("tem as 5 áreas na ordem do kit", () => {
    expect(PORTAL_AREAS.map((a) => a.key)).toEqual(["jornada", "visao", "copilotos", "automacoes", "config"]);
  });
  it("re-hospeda telas legadas na área certa", () => {
    expect(areaForPortalPath("/portal")).toBe("jornada");
    expect(areaForPortalPath("/portal/roi")).toBe("visao");
    expect(areaForPortalPath("/portal/entregaveis")).toBe("visao");
    expect(areaForPortalPath("/portal/consultor")).toBe("copilotos");
    expect(areaForPortalPath("/portal/playbook")).toBe("copilotos");
    expect(areaForPortalPath("/portal/stack")).toBe("automacoes");
    expect(areaForPortalPath("/portal/sessoes")).toBe("automacoes");
    expect(areaForPortalPath("/portal/financeiro")).toBe("config");
    expect(areaForPortalPath("/portal/governanca")).toBe("config");
  });
  it("distingue índices v5 (claros) de telas legadas (frame escuro)", () => {
    expect(isV5PortalPath("/portal")).toBe(true);
    expect(isV5PortalPath("/portal/visao")).toBe(true);
    expect(isV5PortalPath("/portal/roi")).toBe(false);
    expect(isV5PortalPath("/portal/consultor")).toBe(false);
  });
});
