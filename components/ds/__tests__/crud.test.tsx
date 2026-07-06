import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { signalsResource, signalSchema } from "@/lib/crud/resources/signals";
import { duplicateCopy } from "@/lib/crud/types";
import { getResource } from "@/lib/crud/registry";

describe("defineResource · sinais", () => {
  it("valida com o schema compartilhado (aceita válido, recusa inválido)", () => {
    expect(signalSchema.safeParse({ label: "Contratou head", weight: 8, active: true, sort: 1 }).success).toBe(true);
    expect(signalSchema.safeParse({ label: "x", weight: 8, active: true, sort: 1 }).success).toBe(false);   // label curto
    expect(signalSchema.safeParse({ label: "Sinal válido", weight: 99, active: true, sort: 0 }).success).toBe(false); // peso > 50
  });
  it("coage tipos vindos de formulário (strings → number/boolean)", () => {
    const p = signalSchema.parse({ label: "Levantou rodada", weight: "10", active: "on", sort: "2" });
    expect(p).toMatchObject({ weight: 10, active: true, sort: 2 });
  });
  it("permissão é admin-only no servidor", () => {
    expect(signalsResource.permission({ isSalestrackAdmin: true, orgId: "o", userId: "u" }, "delete")).toBe(true);
    expect(signalsResource.permission({ isSalestrackAdmin: false, orgId: "o", userId: "u" }, "create")).toBe(false);
  });
  it("é resolvível pelo nome no registry", () => {
    expect(getResource("signals").table).toBe("signal_definitions");
  });
});

describe("Programa (R2.2)", () => {
  it("schema valida metadados e coage progress/cycle", async () => {
    const { programaSchema } = await import("@/lib/crud/resources/programa");
    const ok = programaSchema.safeParse({ name: "Programa X", phase: "Fundação", status: "ativo", progress_pct: "40", cycle_step: "2" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toMatchObject({ progress_pct: 40, cycle_step: 2 });
    expect(programaSchema.safeParse({ name: "X", status: "ativo", progress_pct: 0, cycle_step: 0 }).success).toBe(false); // nome curto
    expect(programaSchema.safeParse({ name: "Programa X", status: "inexistente", progress_pct: 0, cycle_step: 0 }).success).toBe(false); // status inválido
  });
  it("é admin-only e resolvível pelo registry", async () => {
    const { programaResource } = await import("@/lib/crud/resources/programa");
    expect(programaResource.permission({ isSalestrackAdmin: false, orgId: "o", userId: "u" }, "create")).toBe(false);
    expect(getResource("programa").table).toBe("projects");
  });
  it("duplicateTransform zera datas/contrato e adiciona (cópia)", async () => {
    const { programaResource } = await import("@/lib/crud/resources/programa");
    const copy = duplicateCopy(programaResource, { id: "1", name: "Piloto", contract_id: "c1", activated_at: "x", created_at: "y", deleted_at: null });
    expect(copy.name).toBe("Piloto (cópia)");
    expect(copy.contract_id).toBeUndefined();
    expect(copy.activated_at).toBeUndefined();
    expect(copy.id).toBeUndefined();
  });
});

describe("Oferta / modelo comercial (R2.3 + REV)", () => {
  it("schema valida oferta e coage price/flags", async () => {
    const { ofertaSchema } = await import("@/lib/crud/resources/oferta");
    const ok = ofertaSchema.safeParse({ name: "AI Sprint", brand: "salestrack", kind: "sprint", unit: "sprint", price: "14900", description: "", active: "on", needs_review: "" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toMatchObject({ price: 14900, active: true, needs_review: false });
    expect(ofertaSchema.safeParse({ name: "X", brand: "salestrack", price: 0, active: true, needs_review: false }).success).toBe(false); // nome curto
    expect(ofertaSchema.safeParse({ name: "Oferta", brand: "inexistente", price: 0, active: true, needs_review: false }).success).toBe(false); // marca inválida
  });
  it("oferta é admin-only e resolvível", async () => {
    const { ofertaResource } = await import("@/lib/crud/resources/oferta");
    expect(ofertaResource.permission({ isSalestrackAdmin: false, orgId: null, userId: "u" }, "create")).toBe(false);
    expect(getResource("oferta").table).toBe("catalog_items");
  });
});

describe("duplicateCopy", () => {
  it("aplica sufixo, dropa id/timestamps e mantém o resto", () => {
    const copy = duplicateCopy(signalsResource, { id: "1", label: "Sinal A", weight: 7, active: true, sort: 3, created_at: "x", deleted_at: null });
    expect(copy.id).toBeUndefined();
    expect(copy.created_at).toBeUndefined();
    expect(copy.deleted_at).toBeUndefined();
    expect(copy.label).toBe("Sinal A (cópia)");
    expect(copy.weight).toBe(7);
  });
});
