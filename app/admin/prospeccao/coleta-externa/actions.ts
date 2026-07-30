"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { coletarReacoesDeFonte, coletarAtividade, coletarGrupos, podeColetar } from "@/lib/prospecting/coleta-linkedin";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return { svc: createServiceClient(), m };
}

export async function salvarConfig(dados: {
  ativo: boolean; actorAtividade: string; actorReacoes: string; actorPerfil: string;
  usaCookie: boolean; tetoDia: string; tetoPerfis: string;
}) {
  const { svc } = await exigirAdmin();
  const { error } = await svc.from("coleta_externa_config").update({
    ativo: dados.ativo,
    actor_atividade: dados.actorAtividade.trim() || null,
    actor_reacoes_post: dados.actorReacoes.trim() || null,
    actor_perfil: dados.actorPerfil.trim() || null,
    usa_cookie: dados.usaCookie,
    teto_execucoes_dia: Math.min(50, Math.max(0, Number(dados.tetoDia) || 5)),
    teto_perfis_execucao: Math.min(200, Math.max(1, Number(dados.tetoPerfis) || 25)),
    updated_at: new Date().toISOString(),
  }).eq("id", "unica");
  if (error) throw new Error(error.message);
  await audit(dados.ativo ? "coleta.ligada" : "coleta.desligada", "coleta_externa_config", undefined, {
    usa_cookie: dados.usaCookie, teto_dia: dados.tetoDia,
  });
  revalidatePath("/admin/prospeccao/coleta-externa");
}

/** Religa depois de uma parada automática. Exige gesto humano de propósito. */
export async function religar() {
  const { svc } = await exigirAdmin();
  await svc.from("coleta_externa_config")
    .update({ parado_ate: null, motivo_parada: null, updated_at: new Date().toISOString() })
    .eq("id", "unica");
  await audit("coleta.religada", "coleta_externa_config");
  revalidatePath("/admin/prospeccao/coleta-externa");
}

/** Botão de pânico: para tudo agora, sem prazo. */
export async function pararTudo() {
  const { svc } = await exigirAdmin();
  await svc.from("coleta_externa_config").update({
    ativo: false,
    parado_ate: new Date(Date.now() + 7 * 86400000).toISOString(),
    motivo_parada: "Parada manual pela equipe.",
    updated_at: new Date().toISOString(),
  }).eq("id", "unica");
  await audit("coleta.parada_manual", "coleta_externa_config");
  revalidatePath("/admin/prospeccao/coleta-externa");
}

export async function salvarFonte(dados: { nome: string; url: string; tipo: string }) {
  const { svc } = await exigirAdmin();
  if (!dados.nome.trim() || !dados.url.trim()) throw new Error("Informe o nome e o link.");
  if (!/^https?:\/\/[^\s]*linkedin\.com/i.test(dados.url.trim())) {
    throw new Error("O link precisa ser do LinkedIn.");
  }
  const { error } = await svc.from("linkedin_fontes")
    .insert({ nome: dados.nome.trim(), url: dados.url.trim(), tipo: dados.tipo });
  if (error) {
    throw new Error(/duplicate|unique/i.test(error.message) ? "Esta fonte já está cadastrada." : error.message);
  }
  await audit("coleta.fonte.criada", "linkedin_fontes", undefined, { nome: dados.nome });
  revalidatePath("/admin/prospeccao/coleta-externa");
}

export async function alternarFonte(id: string, ativa: boolean) {
  const { svc } = await exigirAdmin();
  await svc.from("linkedin_fontes").update({ ativa }).eq("id", id);
  revalidatePath("/admin/prospeccao/coleta-externa");
}

export async function removerFonte(id: string) {
  const { svc } = await exigirAdmin();
  await svc.from("linkedin_fontes").delete().eq("id", id);
  await audit("coleta.fonte.removida", "linkedin_fontes", id);
  revalidatePath("/admin/prospeccao/coleta-externa");
}

/** Roda uma fonte agora. Gasta crédito do Apify e expõe a conta — por isso é botão, não efeito. */
export async function rodarFonte(id: string): Promise<string> {
  await exigirAdmin();
  const r = await coletarReacoesDeFonte(id);
  revalidatePath("/admin/prospeccao/coleta-externa");
  if (r.erro) return `Não rodou: ${r.erro}`;
  const custo = r.custoUsd ? ` · custo US$ ${r.custoUsd.toFixed(2)}` : "";
  return `${r.itens} pessoa(s) lida(s) · ${r.casados} já na base ganharam sinal · ${r.novos} nova(s)${custo}.`;
}

export async function rodarAtividade(prospectId: string): Promise<string> {
  await exigirAdmin();
  const r = await coletarAtividade(prospectId);
  revalidatePath("/admin/prospeccao/coleta-externa");
  if (r.erro) return `Não rodou: ${r.erro}`;
  return `${r.itens} item(ns) lido(s), ${r.casados} sobre IA viraram sinal.`;
}

export async function rodarGrupos(prospectId: string): Promise<string> {
  await exigirAdmin();
  const r = await coletarGrupos(prospectId);
  revalidatePath("/admin/prospeccao/coleta-externa");
  if (r.erro) return `Não rodou: ${r.erro}`;
  return r.casados === 0
    ? "Nenhum grupo de IA visível neste perfil — o LinkedIn deixou de expor isso na maioria dos perfis."
    : `${r.casados} grupo(s) de IA encontrado(s).`;
}

export async function verificarPortao(): Promise<string> {
  await exigirAdmin();
  const p = await podeColetar();
  return p.ok ? "A coleta está liberada para rodar." : (p.motivo ?? "Bloqueada.");
}
