import { describe, it, expect } from "vitest";
import { tipoDef, tiposPorFamilia, isPassoAPasso, progressoModulos, tipoSugeridoPorEtapa, DELIVERABLE_TYPES, FAMILIAS } from "@/lib/estudio/catalogo";

describe("UC · Catálogo de entregáveis (lógica pura)", () => {
  it("5 famílias, todos os tipos com família válida", () => {
    expect(FAMILIAS).toHaveLength(5);
    const fams = new Set(FAMILIAS.map((f) => f.key));
    DELIVERABLE_TYPES.forEach((t) => expect(fams.has(t.familia)).toBe(true));
    // cobre os pedidos pelo André
    ["curso", "podcast", "video", "playbook", "documento", "planilha", "workshop", "mapa_mental", "treinamento", "ebook", "aplicacao"].forEach((k) => expect(tipoDef(k).key).toBe(k));
  });

  it("tipoDef com fallback para documento", () => {
    expect(tipoDef("curso").consumo).toBe("passo_a_passo");
    expect(tipoDef("planilha").consumo).toBe("externo");
    expect(tipoDef("dossie").consumo).toBe("single");
    expect(tipoDef("video").consumo).toBe("midia");
    expect(tipoDef("inexistente").key).toBe("documento"); // fallback
  });

  it("passo a passo = curso/treinamento/trilha/workshop/playbook", () => {
    ["curso", "treinamento", "trilha", "workshop", "playbook"].forEach((k) => expect(isPassoAPasso(k)).toBe(true));
    ["documento", "video", "planilha", "roi"].forEach((k) => expect(isPassoAPasso(k)).toBe(false));
  });

  it("agrupamento por família cobre todos os tipos", () => {
    const grupos = tiposPorFamilia();
    expect(grupos).toHaveLength(5);
    expect(grupos.reduce((a, g) => a + g.tipos.length, 0)).toBe(DELIVERABLE_TYPES.length);
  });

  it("progresso de módulos (%)", () => {
    expect(progressoModulos(4, 0)).toBe(0);
    expect(progressoModulos(4, 2)).toBe(50);
    expect(progressoModulos(4, 4)).toBe(100);
    expect(progressoModulos(0, 0)).toBe(0);
  });

  it("tipo sugerido por etapa da jornada", () => {
    expect(tipoSugeridoPorEtapa(2)).toBe("diagnostico");
    expect(tipoSugeridoPorEtapa(5)).toBe("treinamento");
    expect(tipoSugeridoPorEtapa(6)).toBe("roi");
  });
});
