import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { runAgentCore } from "@/lib/agents/runner";

/**
 * Resposta assistida da inbox.
 *
 * ── A regra que não se negocia ────────────────────────────────────────────────────────────────
 * A IA prepara; a pessoa envia. Resposta automática em canal de cliente é o tipo de automação que
 * só se percebe depois de errar — e no WhatsApp o erro chega no celular de alguém sem chance de
 * recall. O ganho está em abrir a conversa e já encontrar a resposta pronta para revisar, não em
 * tirar o humano do caminho.
 *
 * ── Uma sugestão por mensagem ─────────────────────────────────────────────────────────────────
 * Reprocessar o mesmo webhook não gera segunda sugestão. Sem isso, uma reentrega da Z-API encheria
 * a conversa de rascunhos idênticos — e quem abrisse não saberia qual é o atual.
 */

const HISTORICO = 6;

/**
 * Regras que o operador NÃO edita na tela de Agentes.
 *
 * O prompt editável define tom e prioridades; estas quatro linhas existem porque o texto vai sair no
 * WhatsApp de um cliente. Inventar um prazo ou um preço aqui não é uma resposta ruim — é um
 * compromisso que a empresa vai ter de honrar ou desdizer.
 */
const REGRAS = `
REGRAS INVIOLÁVEIS:
- Escreva APENAS o texto da mensagem a ser enviada. Sem saudação de e-mail, sem assinatura, sem aspas, sem comentários sobre a própria resposta.
- NUNCA invente preço, prazo, data, número ou promessa. Se o dado não está na conversa, escreva que vai confirmar e retornar.
- Português do Brasil, tom da Salestrack: direto, cordial, sem jargão. Mensagem curta — é WhatsApp, não relatório.
- Se a conversa pedir uma decisão que só um humano pode tomar, escreva uma resposta que reconhece o pedido e ganha tempo, sem se comprometer.`;

export async function gerarSugestao(opts: {
  conversaId: string; mensagemId?: string | null;
}): Promise<{ id: string; texto: string } | null> {
  const sb = createServiceClient();

  // Agente desligado é resposta legítima: quem opera decide quando quer ajuda.
  const { data: agente } = await sb.from("agent_prompts")
    .select("agent_key, max_tokens")
    .eq("gatilho", "mensagem_recebida").eq("tipo", "gatilho").eq("ativo", true).limit(1).maybeSingle();
  if (!agente) return null;

  if (opts.mensagemId) {
    const { data: ja } = await sb.from("rel_sugestoes")
      .select("id").eq("mensagem_id", opts.mensagemId).limit(1).maybeSingle();
    if (ja) return null;
  }

  const { data: conversa } = await sb.from("rel_conversas")
    .select("id, org_id, channel, contato_nome, assunto").eq("id", opts.conversaId).maybeSingle();
  if (!conversa) return null;

  /**
   * As últimas mensagens, na ordem da conversa. Sem histórico, o agente responde à última frase
   * fora de contexto — e "quanto custa?" sem saber do que se fala produz resposta genérica, que é
   * pior que nenhuma.
   */
  const { data: msgs } = await sb.from("rel_mensagens")
    .select("direction, corpo, created_at").eq("conversa_id", opts.conversaId)
    .order("created_at", { ascending: false }).limit(HISTORICO);

  const historico = (msgs ?? []).reverse()
    .map((m) => `${m.direction === "in" ? "Cliente" : "Salestrack"}: ${(m.corpo ?? "").slice(0, 600)}`)
    .join("\n");
  if (!historico.trim()) return null;

  const r = await runAgentCore({
    agentKey: agente.agent_key,
    guardrails: REGRAS,
    contextLabel: "CONVERSA",
    extraContext: `Canal: ${conversa.channel}. Contato: ${conversa.contato_nome ?? "não identificado"}.\n\n${historico}`,
    userMessages: [{ role: "user", content: "Escreva a resposta a ser enviada agora." }],
    maxTokens: agente.max_tokens ?? 600,
    orgId: conversa.org_id as string | null,
  });
  if (r.degraded) return null;

  const { data, error } = await sb.from("rel_sugestoes").insert({
    conversa_id: opts.conversaId,
    mensagem_id: opts.mensagemId ?? null,
    org_id: conversa.org_id,
    agent_key: agente.agent_key,
    texto: r.text,
    tokens: r.tokens,
  }).select("id").single();
  if (error) {
    console.error("[sugestão] não gravou:", error.message);
    return null;
  }
  return { id: data.id as string, texto: r.text };
}

/**
 * Prepara rascunhos para as conversas que a triagem marcou como "precisa de você".
 *
 * ── Por que passa pela triagem, e não por toda mensagem que chega ─────────────────────────────
 * Metade da caixa é máquina. Escrever resposta para um relatório DMARC ou para uma newsletter
 * custa dinheiro e, pior, enche a lista de "resposta pronta" onde não há nada a responder — o
 * mesmo problema que a triagem existe para resolver, agora com um selo de IA em cima.
 *
 * ── Por que só quando a última palavra é do outro lado ────────────────────────────────────────
 * Se a última mensagem é nossa, a bola está com ele. Um rascunho ali seria cobrança disfarçada de
 * ajuda, e ninguém pediu isso.
 */
export async function gerarSugestoesPendentes(max = 5): Promise<{ geradas: number }> {
  const sb = createServiceClient();
  const { data: convs } = await sb.from("rel_conversas")
    .select("id, channel").eq("triagem", "precisa_resposta").eq("status", "aberta")
    .is("deleted_at", null).order("last_message_at", { ascending: false }).limit(max * 4);

  let geradas = 0;
  for (const c of convs ?? []) {
    if (geradas >= max) break;

    const { data: ultima } = await sb.from("rel_mensagens")
      .select("id, direction").eq("conversa_id", c.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ultima || ultima.direction !== "in") continue;

    const { data: ja } = await sb.from("rel_sugestoes")
      .select("id").eq("mensagem_id", ultima.id).limit(1).maybeSingle();
    if (ja) continue;

    // No e-mail, o que a sincronização guarda é o trecho; o corpo completo só chega quando alguém
    // abre. Rascunhar em cima de duas linhas produz resposta genérica — que é pior do que nenhuma.
    if (c.channel === "email") {
      const { carregarCorposEmailService } = await import("./sync-email");
      await carregarCorposEmailService(c.id as string);
    }

    const r = await gerarSugestao({ conversaId: c.id as string, mensagemId: ultima.id as string });
    if (r) geradas++;
  }
  return { geradas };
}

/**
 * Foi aceita como estava, ou reescrita?
 *
 * Vive aqui, e não dentro da action, porque é a regra que sustenta o painel de acerto do agente: se
 * um espaço no fim contasse como edição, o número diria que o agente erra mais do que erra; se uma
 * palavra trocada contasse como acerto, diria o contrário. Os dois enganos levam ao mesmo lugar —
 * ninguém ajusta o prompt.
 */
export function classificarDecisao(sugerido: string, enviado: string): "aprovada" | "editada" {
  return enviado.trim() === sugerido.trim() ? "aprovada" : "editada";
}

/**
 * Marca o desfecho da sugestão.
 *
 * `editada` guarda o texto que FOI enviado, e é o dado que mais importa: sugestão aprovada sem
 * mudança é acerto; muito editada é sinal de que o prompt precisa de ajuste. Sem guardar as duas
 * versões, não há como saber se o agente ajuda ou dá trabalho.
 */
export async function decidirSugestao(
  id: string, status: "aprovada" | "editada" | "descartada",
  textoEnviado: string | null, autor: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb.from("rel_sugestoes").update({
    status, texto_enviado: status === "editada" ? textoEnviado : null,
    decidido_por: autor, decidido_em: new Date().toISOString(),
  }).eq("id", id);
}

export type SugestaoPendente = {
  id: string; conversaId: string; texto: string; contato: string | null;
  canal: string; quando: string;
};

export async function sugestoesPendentes(limite = 20): Promise<SugestaoPendente[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("rel_sugestoes")
    .select("id, conversa_id, texto, created_at, rel_conversas(contato_nome, channel)")
    .eq("status", "pendente").order("created_at", { ascending: false }).limit(limite);

  return (data ?? []).map((s) => {
    const c = s.rel_conversas as unknown as { contato_nome: string | null; channel: string } | null;
    return {
      id: s.id as string, conversaId: s.conversa_id as string, texto: s.texto as string,
      contato: c?.contato_nome ?? null, canal: c?.channel ?? "—", quando: s.created_at as string,
    };
  });
}

/** Quanto o agente acerta: aprovada sem edição / total decidido. */
export async function taxaDeAcerto(): Promise<{ aprovadas: number; editadas: number; descartadas: number } | null> {
  const sb = createServiceClient();
  const { data } = await sb.from("rel_sugestoes").select("status").neq("status", "pendente");
  if (!data?.length) return null;
  return {
    aprovadas: data.filter((s) => s.status === "aprovada").length,
    editadas: data.filter((s) => s.status === "editada").length,
    descartadas: data.filter((s) => s.status === "descartada").length,
  };
}
