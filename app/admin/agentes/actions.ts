"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { runAgentCore } from "@/lib/agents/runner";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return { svc: createServiceClient(), m };
}

/**
 * Publica uma nova versão do prompt.
 *
 * Não sobrescreve: cria versão nova e desativa a anterior. Um prompt é a definição do
 * comportamento do agente — quando ele piora depois de um ajuste, é preciso poder voltar, e
 * comparar o que mudou.
 */
export async function publicarVersao(dados: {
  agentKey: string; systemPrompt: string; motivo: string;
  modelo: string; maxTokens: string; temperatura: string;
}) {
  const { svc, m } = await exigirAdmin();
  if (!dados.systemPrompt.trim()) throw new Error("O prompt não pode ficar vazio.");
  if (!dados.motivo.trim()) throw new Error("Diga o que mudou — é o que dá serventia ao histórico.");

  const { data: atual } = await svc.from("agent_prompts")
    .select("versao, titulo, descricao").eq("agent_key", dados.agentKey)
    .order("versao", { ascending: false }).limit(1).maybeSingle();

  // Desativa antes de inserir: o índice único garante uma ativa por agente, e inserir primeiro
  // esbarraria nele.
  await svc.from("agent_prompts").update({ ativo: false }).eq("agent_key", dados.agentKey).eq("ativo", true);

  const { error } = await svc.from("agent_prompts").insert({
    agent_key: dados.agentKey,
    versao: (atual?.versao ?? 0) + 1,
    ativo: true,
    system_prompt: dados.systemPrompt.trim(),
    titulo: atual?.titulo ?? null,
    descricao: atual?.descricao ?? null,
    modelo: dados.modelo || null,
    max_tokens: dados.maxTokens ? Number(dados.maxTokens) : null,
    temperatura: dados.temperatura ? Number(dados.temperatura) : null,
    motivo_da_versao: dados.motivo.trim(),
    autor: m.userId,
  });
  if (error) throw new Error(error.message);

  await audit("agente.versao_publicada", "agent_prompts", undefined,
    { agente: dados.agentKey, versao: (atual?.versao ?? 0) + 1, motivo: dados.motivo });
  revalidatePath("/admin/agentes");
}

/** Volta para uma versão anterior. Reativa a antiga em vez de copiar — o histórico fica linear. */
export async function reverterPara(agentKey: string, versao: number) {
  const { svc } = await exigirAdmin();
  await svc.from("agent_prompts").update({ ativo: false }).eq("agent_key", agentKey).eq("ativo", true);
  const { error } = await svc.from("agent_prompts")
    .update({ ativo: true }).eq("agent_key", agentKey).eq("versao", versao);
  if (error) throw new Error(error.message);
  await audit("agente.revertido", "agent_prompts", undefined, { agente: agentKey, para_versao: versao });
  revalidatePath("/admin/agentes");
}

/**
 * Testa o agente com o prompt que está NA TELA, sem publicar.
 *
 * Publicar para descobrir se ficou bom significa que o cliente é a cobaia. Aqui o ajuste é
 * exercitado antes de virar a versão ativa.
 */
export async function testarAgente(dados: {
  agentKey: string; systemPrompt: string; pergunta: string;
}): Promise<{ resposta: string; tokens: number; degradado: boolean }> {
  await exigirAdmin();
  if (!dados.pergunta.trim()) throw new Error("Escreva uma pergunta de teste.");

  const r = await runAgentCore({
    agentKey: dados.agentKey,
    guardrails: dados.systemPrompt.trim(),   // usa o texto da tela, não o publicado
    userMessages: [{ role: "user", content: dados.pergunta }],
    maxTokens: 800,
  });
  return { resposta: r.text, tokens: r.tokens, degradado: r.degraded };
}

/**
 * Cria um agente pela interface.
 *
 * `tipo` é obrigatório e não tem padrão silencioso: um agente sem saber QUEM o chama é um agente
 * que aparece na lista, parece pronto e nunca roda. Avulso = você clica; gatilho = um evento
 * dispara. Não há terceira opção criável pela tela — "sistema" exige código.
 */
export async function criarAgente(dados: {
  titulo: string; descricao: string; tipo: "avulso" | "gatilho";
  gatilho: string; systemPrompt: string; instrucaoContexto: string;
  modelo: string; maxTokens: string;
}) {
  const { svc, m } = await exigirAdmin();
  if (!dados.titulo.trim()) throw new Error("Dê um nome ao agente.");
  if (!dados.systemPrompt.trim()) throw new Error("Escreva as instruções do agente.");
  if (dados.tipo === "gatilho" && !dados.gatilho) {
    throw new Error("Escolha o evento que dispara este agente — sem isso ele nunca rodaria.");
  }

  // A chave é derivada do nome: legível no log e estável. Sufixo numérico só se colidir.
  const base = dados.titulo.trim().toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "agente";

  let chave = base;
  for (let i = 2; i <= 20; i++) {
    const { data: existe } = await svc.from("agent_prompts")
      .select("agent_key").eq("agent_key", chave).limit(1).maybeSingle();
    if (!existe) break;
    chave = `${base}_${i}`;
  }

  const { error } = await svc.from("agent_prompts").insert({
    agent_key: chave, versao: 1, ativo: true,
    titulo: dados.titulo.trim(),
    descricao: dados.descricao.trim() || null,
    system_prompt: dados.systemPrompt.trim(),
    instrucao_contexto: dados.instrucaoContexto.trim() || null,
    tipo: dados.tipo,
    gatilho: dados.tipo === "gatilho" ? dados.gatilho : null,
    modelo: dados.modelo || null,
    max_tokens: dados.maxTokens ? Number(dados.maxTokens) : null,
    motivo_da_versao: "Agente criado.",
    autor: m.userId,
  });
  if (error) throw new Error(error.message);

  await audit("agente.criado", "agent_prompts", undefined,
    { agente: chave, tipo: dados.tipo, gatilho: dados.gatilho || null });
  revalidatePath("/admin/agentes");
}

/** Roda um agente avulso com o contexto colado. Guarda a rodada — resposta some, histórico não. */
export async function rodarAvulso(dados: { agentKey: string; contexto: string }): Promise<string> {
  const { svc, m } = await exigirAdmin();
  if (!dados.contexto.trim()) throw new Error("Cole o conteúdo que o agente deve analisar.");

  const { data: a } = await svc.from("agent_prompts")
    .select("versao, system_prompt, max_tokens").eq("agent_key", dados.agentKey)
    .eq("ativo", true).maybeSingle();
  if (!a) throw new Error("Agente não encontrado ou desativado.");

  const r = await runAgentCore({
    agentKey: dados.agentKey,
    guardrails: "Responda em português do Brasil, direto ao ponto.",
    userMessages: [{ role: "user", content: dados.contexto }],
    maxTokens: a.max_tokens ?? 1500,
  });

  await svc.from("agente_rodadas").insert({
    agent_key: dados.agentKey, versao: a.versao,
    contexto: dados.contexto.slice(0, 4000),
    resposta: r.degraded ? null : r.text,
    erro: r.degraded ? r.text : null,
    tokens: r.tokens, origem: "avulso", autor: m.userId,
  });

  revalidatePath("/admin/agentes");
  return r.text;
}

/** Desativa sem apagar: o histórico de rodadas continua explicando o que ele produziu. */
export async function arquivarAgente(agentKey: string) {
  const { svc } = await exigirAdmin();
  await svc.from("agent_prompts").update({ ativo: false }).eq("agent_key", agentKey).eq("ativo", true);
  await audit("agente.arquivado", "agent_prompts", undefined, { agente: agentKey });
  revalidatePath("/admin/agentes");
}
