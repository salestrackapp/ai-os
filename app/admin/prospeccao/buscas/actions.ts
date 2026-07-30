"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { executarBusca, type Busca, type ResultadoColeta } from "@/lib/prospecting/coleta";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return { svc: createServiceClient(), m };
}

const lista = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

export async function salvarBusca(dados: {
  id?: string; nome: string; icp: string; cargos: string; senioridades: string;
  setores: string; locais: string; porte: string; palavrasChave: string;
  meta: string; teto: string; ativa: boolean;
}) {
  const { svc, m } = await exigirAdmin();
  if (!dados.nome.trim()) throw new Error("Dê um nome à busca.");

  const cargos = lista(dados.cargos);
  const locais = lista(dados.locais);
  // Busca sem cargo NEM local é varredura, não prospecção — e é justamente a distinção em que o
  // teste de proporcionalidade se apoia. O sistema não deixa criar uma.
  if (cargos.length === 0 && locais.length === 0) {
    throw new Error("Informe ao menos os cargos ou os locais. Uma busca sem recorte traz gente que nunca teve o problema que resolvemos — e tratar esse dado não se sustenta.");
  }

  const linha = {
    nome: dados.nome.trim(), icp: dados.icp || null,
    cargos, senioridades: lista(dados.senioridades), setores: lista(dados.setores),
    locais, porte: lista(dados.porte),
    palavras_chave: dados.palavrasChave.trim() || null,
    meta_por_execucao: Math.min(200, Math.max(1, Number(dados.meta) || 25)),
    teto_enriquecimento: Math.min(200, Math.max(0, Number(dados.teto) || 25)),
    ativa: dados.ativa, updated_at: new Date().toISOString(),
  };

  const { error } = dados.id
    ? await svc.from("prospect_buscas").update(linha).eq("id", dados.id)
    : await svc.from("prospect_buscas").insert({ ...linha, created_by: m.userId });
  if (error) throw new Error(error.message);

  await audit(dados.id ? "prospeccao.busca.editada" : "prospeccao.busca.criada", "prospect_buscas", dados.id, { nome: linha.nome });
  revalidatePath("/admin/prospeccao/buscas");
}

export async function alternarBusca(id: string, ativa: boolean) {
  const { svc } = await exigirAdmin();
  await svc.from("prospect_buscas").update({ ativa, updated_at: new Date().toISOString() }).eq("id", id);
  await audit(ativa ? "prospeccao.busca.ativada" : "prospeccao.busca.pausada", "prospect_buscas", id);
  revalidatePath("/admin/prospeccao/buscas");
}

export async function arquivarBusca(id: string) {
  const { svc } = await exigirAdmin();
  // Arquiva em vez de apagar: os prospects já coletados apontam para ela, e a busca é o registro
  // de POR QUE aquelas pessoas entraram na base — o que é parte da demonstração de conformidade.
  await svc.from("prospect_buscas")
    .update({ deleted_at: new Date().toISOString(), ativa: false }).eq("id", id);
  await audit("prospeccao.busca.arquivada", "prospect_buscas", id);
  revalidatePath("/admin/prospeccao/buscas");
}

/** Roda a busca agora, sem esperar o cron. Gasta crédito do Apollo — por isso é botão, não efeito. */
export async function rodarAgora(id: string): Promise<ResultadoColeta> {
  const { svc } = await exigirAdmin();
  const { data } = await svc.from("prospect_buscas")
    .select("id, nome, icp, cargos, senioridades, setores, locais, porte, palavras_chave, meta_por_execucao, teto_enriquecimento, campaign_id, ultima_pagina")
    .eq("id", id).single();
  if (!data) throw new Error("Busca não encontrada.");
  const r = await executarBusca(data as Busca);
  revalidatePath("/admin/prospeccao/buscas");
  return r;
}
