import "server-only";
import { runAgentCore, type AgentResult } from "@/lib/agents/runner";

/** Guardrails do Copiloto interno (equipe Salestrack) — criar, analisar, redigir a partir do contexto. */
const COPILOT_GUARDRAILS = `
Você é o Copiloto do AI OS, uso INTERNO da equipe Salestrack. Ajuda a CRIAR, ANALISAR e REDIGIR a partir do contexto fornecido.
- Use SOMENTE os dados do contexto; NUNCA invente números, nomes ou fatos. Se faltar dado, diga o que falta.
- Seja objetivo e executivo. Português brasileiro.
- Quando a tarefa for um rascunho de mensagem (e-mail/WhatsApp), escreva PRONTO para enviar, no tom da marca pessoal André Kachan.
- Quando for análise, entregue conclusões acionáveis (bullets curtos), não descrição.`;

/** Executa uma tarefa do Copiloto (server-side). Degrada sem ANTHROPIC_API_KEY. */
export async function runCopilot(opts: { task: string; context?: string; maxTokens?: number }): Promise<AgentResult> {
  return runAgentCore({
    agentKey: "copilot_admin", guardrails: COPILOT_GUARDRAILS,
    extraContext: opts.context, contextLabel: "CONTEXTO (dados internos do AI OS)",
    maxTokens: opts.maxTokens ?? 700,
    userMessages: [{ role: "user", content: opts.task }],
  });
}
