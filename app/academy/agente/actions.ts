"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import type { DadosAgente, DefinicaoFerramenta } from "@/lib/academy/builder";

/**
 * Salva um agente do aluno. A RLS de academy_agents já exige user_id = quem chama,
 * então não há checagem manual de posse aqui.
 */
export async function salvarAgente(input: {
  id?: string;
  dados: DadosAgente;
  systemPrompt: string;
  ferramentas: DefinicaoFerramenta[];
}) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  if (!input.dados.nome.trim()) throw new Error("Dê um nome ao agente antes de salvar.");

  const linha = {
    user_id: user.id,
    nome: input.dados.nome.trim(),
    area: input.dados.area || null,
    missao: input.dados.missao || null,
    dados: input.dados as unknown as Record<string, unknown>,
    system_prompt: input.systemPrompt,
    tools_json: input.ferramentas as unknown as Record<string, unknown>,
    status: "pronto" as const,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await sb.from("academy_agents").update(linha).eq("id", input.id);
    if (error) throw new Error(error.message);
    await audit("academy.agente_atualizado", "academy_agents", input.id, { nome: linha.nome });
  } else {
    const { data, error } = await sb.from("academy_agents").insert(linha).select("id").single();
    if (error) throw new Error(error.message);
    await audit("academy.agente_criado", "academy_agents", data.id, { nome: linha.nome });
  }
  revalidatePath("/academy");
  revalidatePath("/academy/agente");
}

export async function excluirAgente(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("academy_agents")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("academy.agente_excluido", "academy_agents", id);
  revalidatePath("/academy");
  revalidatePath("/academy/agente");
}
