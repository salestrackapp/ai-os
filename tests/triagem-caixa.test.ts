import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => { throw new Error("não deveria tocar no banco"); } }));
vi.mock("@/lib/agents/runner", () => ({ runAgentCore: async () => ({ text: "", tokens: 0, degraded: true, model: null }), anthropicConfigured: () => false }));

const { triarPeloRemetente } = await import("@/lib/relacionamento/triagem");

/**
 * Os casos vêm da caixa REAL da Salestrack, não de exemplos inventados.
 *
 * É o que dá valor ao teste: a regra existe para lidar com o que chega de fato — relatório DMARC da
 * Microsoft, aviso de domínio do registro.br, newsletter no beehiiv, o próprio AI OS mandando
 * "Novo lead". Um teste com `noreply@exemplo.com` provaria que a regex compila, não que ela serve.
 */

const MAQUINA = [
  "dmarcreport@microsoft.com",
  "no-reply@accounts.google.com",
  "nao-responda@asaas.com.br",
  "notifications@github.com",
  "invoice+statements@vercel.com",
  "billing@openai.com",
  "security-noreply@linkedin.com",
  "dse_na4@docusign.net",
];

const NOSSO = ["aios@salestrack.com.br", "andre.kachan@salestrack.com.br"];

const DISPARO = [
  "hello@mail.beehiiv.com",
  "contato@mkt.prospin.com.br",
  "team@e.read.ai",
  "noticias@news.magnific.com",
  "x@mail.app.supabase.io",
];

/**
 * Endereços de gente. Alguns são prospecção fria — e é de propósito que a camada 1 os deixe passar:
 * distinguir "vendedor me escrevendo pela primeira vez" de "cliente pedindo prazo" não é trabalho
 * de regex, e fingir que é produziria o pior erro possível, que é engolir e-mail de cliente.
 */
const PESSOAS = [
  "lco.souza@gmail.com",
  "jorge.freire@grupopbe.com",
  "marcelo@reachr.com.br",
  "ian@go-productized.com",
  "glenda.black@mags.cioreview.com",
];

describe("triagem pelo remetente (camada sem IA)", () => {
  it.each(MAQUINA)("%s é caixa que não lê resposta", (e) => {
    expect(triarPeloRemetente(e)?.categoria).toBe("automatico");
  });

  it.each(NOSSO)("%s é o nosso próprio endereço", (e) => {
    const v = triarPeloRemetente(e);
    expect(v?.categoria).toBe("automatico");
    expect(v?.motivo).toMatch(/próprio endereço/);
  });

  it.each(DISPARO)("%s é disparo em massa", (e) => {
    expect(triarPeloRemetente(e)?.categoria).toBe("promocional");
  });

  it.each(PESSOAS)("%s a regex NÃO decide — vai para a camada de julgamento", (e) => {
    expect(triarPeloRemetente(e)).toBeNull();
  });

  it("sempre explica o motivo — classificação sem motivo ninguém consegue contestar", () => {
    for (const e of [...MAQUINA, ...NOSSO, ...DISPARO]) {
      expect(triarPeloRemetente(e)!.motivo.length, e).toBeGreaterThan(10);
    }
  });

  it("entrada vazia ou sem @ não vira veredito", () => {
    expect(triarPeloRemetente(null)).toBeNull();
    expect(triarPeloRemetente("")).toBeNull();
    expect(triarPeloRemetente("fulano")).toBeNull();
  });

  /**
   * Achado na primeira rodada em produção: metade do que entrou em "precisa de você" eram avisos
   * de calendário. O remetente é uma pessoa de verdade — por isso a camada de julgamento hesitou —
   * mas ninguém responde a "Aceito: Reunião".
   */
  it.each([
    "Aceito: Reunião André x Luciano — Assuntos de IA",
    "Accepted: Treinamento de IA para Equipe | Salestrack AI",
    "Aceita: Agentes no Claude — André & René",
    "Declined: Diagnóstico comercial",
    "Convite: Kickoff do programa",
  ])("assunto %s é aviso de calendário, mesmo vindo de gente", (assunto) => {
    const v = triarPeloRemetente("jorge.freire@grupopbe.com", assunto);
    expect(v?.categoria).toBe("informativo");
  });

  it("mas responder a um convite É conversa — o Re: na frente muda tudo", () => {
    expect(triarPeloRemetente("lco.souza@gmail.com", "Re: Convite de remetente desconhecido: Reunião")).toBeNull();
  });

  it("não confunde nome de pessoa que contenha uma palavra da lista", () => {
    // "newsletter" é bloqueio; "newton" não pode ser. O separador na regex é o que garante isso.
    expect(triarPeloRemetente("newton.alves@empresa.com.br")).toBeNull();
    expect(triarPeloRemetente("alerta.silva@empresa.com.br")).toBeNull();
    expect(triarPeloRemetente("newsletter@empresa.com.br")?.categoria).toBe("automatico");
  });
});
