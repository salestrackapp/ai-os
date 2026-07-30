import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { runAgentCore } from "./runner";

/**
 * Agentes que rodam sozinhos, em eventos do sistema.
 *
 * ── Conjunto FECHADO de gatilhos, e por quê ──────────────────────────────────────────────────
 * Cada gatilho precisa de dois lados: um ponto no código que o dispara, e um contexto montado com
 * os dados certos. "Qualquer evento" não existe — o que existe é o evento que alguém instrumentou.
 * Deixar o operador digitar o nome de um gatilho produziria agentes esperando por algo que nunca
 * acontece.
 *
 * Para acrescentar um gatilho novo: some aqui, monte o contexto em `montarContexto`, e chame
 * `dispararGatilho` no ponto do código onde o evento acontece. Os três passos, sempre.
 */

export const GATILHOS = {
  lead_novo: {
    rotulo: "Quando um lead novo chega",
    descricao: "Dispara assim que alguém preenche o formulário de um dos sites.",
    recebe: "Nome, e-mail, empresa, mensagem e origem do lead.",
  },
  deal_mudou_etapa: {
    rotulo: "Quando um negócio muda de etapa",
    descricao: "Dispara ao mover um card no CRM.",
    recebe: "Título do negócio, etapa anterior, etapa nova e valor.",
  },
  fatura_venceu: {
    rotulo: "Quando uma fatura vence sem pagamento",
    descricao: "Dispara na régua de cobrança diária.",
    recebe: "Cliente, valor, dias de atraso e o que já foi avisado.",
  },
  entrega_atrasou: {
    rotulo: "Quando uma entrega passa do prazo",
    descricao: "Dispara quando o prazo vence sem entrega — e não dispara em projeto parado.",
    recebe: "Cliente, o que era, prazo original e dias de atraso.",
  },
  prospect_respondeu: {
    rotulo: "Quando um prospect responde",
    descricao: "Dispara ao registrar uma resposta na prospecção.",
    recebe: "Nome, empresa, cargo e o texto da resposta.",
  },
  proposta_aberta: {
    rotulo: "Quando o cliente abre a proposta",
    descricao: "Dispara na primeira leitura da proposta enviada.",
    recebe: "Cliente, título da proposta e valor.",
  },
  /**
   * ÚNICO gatilho que NÃO passa por `dispararGatilho`.
   *
   * Os outros cinco produzem um texto que fica guardado em `agente_rodadas` para alguém ler depois.
   * Este produz um rascunho de resposta que precisa aparecer DENTRO da conversa, com botão de enviar —
   * então quem o executa é `lib/relacionamento/sugestao.ts`, gravando em `rel_sugestoes`.
   *
   * Consequência prática: só o PRIMEIRO agente ativo aqui é usado. Dois agentes gerariam dois
   * rascunhos concorrentes para a mesma mensagem, e a inbox teria de perguntar qual vale — o que
   * é exatamente a decisão que a resposta assistida existe para evitar.
   */
  mensagem_recebida: {
    rotulo: "Quando chega mensagem de um cliente",
    descricao: "Escreve um rascunho de resposta na conversa. Nada é enviado sem alguém aprovar.",
    recebe: "As últimas mensagens da conversa, o canal e o nome do contato.",
  },
} as const;

export type Gatilho = keyof typeof GATILHOS;

/**
 * Dispara os agentes inscritos num evento.
 *
 * NUNCA lança e NUNCA bloqueia o chamador: um agente que falha não pode impedir o lead de entrar
 * nem a fatura de ser cobrada. O trabalho principal acontece primeiro; o agente é consequência.
 */
export async function dispararGatilho(
  gatilho: Gatilho,
  contexto: Record<string, unknown>,
  ref?: { tipo: string; id: string; orgId?: string | null },
): Promise<void> {
  // Tem dono próprio (ver o comentário do gatilho). Passar por aqui geraria um segundo texto, órfão.
  if (gatilho === "mensagem_recebida") return;
  try {
    const sb = createServiceClient();
    const { data: agentes } = await sb.from("agent_prompts")
      .select("agent_key, versao, system_prompt, max_tokens")
      .eq("tipo", "gatilho").eq("gatilho", gatilho).eq("ativo", true);

    if (!agentes?.length) return;

    for (const a of agentes) {
      try {
        const texto = Object.entries(contexto)
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join("\n");

        const r = await runAgentCore({
          agentKey: a.agent_key,
          guardrails: "Responda em português do Brasil, de forma direta e acionável.",
          userMessages: [{ role: "user", content: texto }],
          maxTokens: a.max_tokens ?? 800,
          orgId: ref?.orgId ?? null,
        });

        await sb.from("agente_rodadas").insert({
          agent_key: a.agent_key, versao: a.versao,
          contexto: texto.slice(0, 4000),
          resposta: r.degraded ? null : r.text,
          erro: r.degraded ? "IA indisponível no momento do gatilho." : null,
          tokens: r.tokens, origem: "gatilho",
          ref_tipo: ref?.tipo ?? null, ref_id: ref?.id ?? null, org_id: ref?.orgId ?? null,
        });
      } catch (e) {
        console.error(`[gatilho ${gatilho}] agente ${a.agent_key} falhou:`, (e as Error).message);
      }
    }
  } catch (e) {
    console.error(`[gatilho ${gatilho}] não pôde disparar:`, (e as Error).message);
  }
}

/** Quantos agentes escutam cada evento. A tela mostra para ninguém criar duplicata sem saber. */
export async function contagemPorGatilho(): Promise<Record<string, number>> {
  const sb = createServiceClient();
  const { data } = await sb.from("agent_prompts")
    .select("gatilho").eq("tipo", "gatilho").eq("ativo", true).not("gatilho", "is", null);
  const c: Record<string, number> = {};
  for (const r of data ?? []) c[r.gatilho as string] = (c[r.gatilho as string] ?? 0) + 1;
  return c;
}
