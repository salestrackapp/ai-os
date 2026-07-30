/**
 * Enriquecimento nunca pode sobrescrever dado existente.
 * É a propriedade de segurança do Apollo: se ela falhar, um enriquecimento troca em silêncio o
 * e-mail que uma pessoa confirmou por um que o Apollo adivinhou — e ninguém percebe.
 */
import { describe, it, expect, vi } from "vitest";

// getSecret abre cliente Supabase; irrelevante para a função pura sob teste.
vi.mock("@/lib/settings/secrets", () => ({ getSecret: async () => null }));

const { mergePreservandoExistente } = await import("@/lib/apollo");

describe("mergePreservandoExistente", () => {
  it("NÃO sobrescreve campo já preenchido", () => {
    const atual = { email: "confirmado@cliente.com.br", phone: null };
    const patch = mergePreservandoExistente(atual, { email: "chutado@apollo.io", phone: "+5511999999999" });
    expect(patch.email, "e-mail existente foi sobrescrito").toBeUndefined();
    expect(patch.phone).toBe("+5511999999999");
  });

  it("trata string vazia como campo vazio", () => {
    const patch = mergePreservandoExistente({ role: "" }, { role: "Diretor" });
    expect(patch.role).toBe("Diretor");
  });

  it("ignora valores nulos ou vazios vindos do Apollo", () => {
    const patch = mergePreservandoExistente({ phone: null, role: null }, { phone: null, role: "" });
    expect(Object.keys(patch)).toHaveLength(0);
  });

  it("devolve patch vazio quando o contato já tem tudo", () => {
    const atual = { email: "a@b.com", phone: "+551130000000", role: "CEO" };
    const patch = mergePreservandoExistente(atual, { email: "x@y.com", phone: "+559", role: "CTO" });
    expect(Object.keys(patch)).toHaveLength(0);
  });
});
