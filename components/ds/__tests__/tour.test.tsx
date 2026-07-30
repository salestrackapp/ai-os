import { describe, it, expect } from "vitest";
import { ADMIN_STEPS } from "@/lib/tour/steps.admin";
import { PORTAL_STEPS } from "@/lib/tour/steps.portal";
import type { TourStep } from "@/lib/tour/types";

// Alvos data-tour realmente marcados nos shells/páginas (R5.4 · nav U5/U4).
const ADMIN_ANCHORS = new Set(["brand", "admin-hoje", "nav-jornadas", "nav-comercial", "nav-estudio"]);
const PORTAL_ANCHORS = new Set(["brand", "portal-jornada", "nav-jornada", "nav-entregas", "nav-conta"]);
const anchorOf = (target: string) => target.match(/^\[data-tour='([a-z-]+)'\]$/)?.[1];

function assertWellFormed(steps: TourStep[], anchors: Set<string>) {
  expect(steps.length).toBeGreaterThanOrEqual(5);
  for (const s of steps) {
    const a = anchorOf(s.target);
    expect(a, `alvo mal formado: ${s.target}`).toBeTruthy();
    expect(anchors.has(a!), `alvo sem elemento real: ${a}`).toBe(true);
    expect(s.titulo.length).toBeGreaterThan(0);
    expect(s.corpo.length).toBeGreaterThan(0);
    // sem códigos internos / jargão na copy do cliente
    expect(`${s.titulo} ${s.corpo}`).not.toMatch(/\bR[1-5]\.\d/);
  }
}

describe("R5.4 · Registro de passos do tour", () => {
  it("admin: passos bem formados, ancorados a elementos reais", () => {
    assertWellFormed(ADMIN_STEPS, ADMIN_ANCHORS);
  });
  it("portal: passos bem formados, ancorados a elementos reais", () => {
    assertWellFormed(PORTAL_STEPS, PORTAL_ANCHORS);
  });
  it("tours são demonstrativos: nenhum passo navega para fora nem executa ação (sem route)", () => {
    for (const steps of [ADMIN_STEPS, PORTAL_STEPS]) {
      expect(steps.every((s) => !s.route)).toBe(true);
    }
  });
});
