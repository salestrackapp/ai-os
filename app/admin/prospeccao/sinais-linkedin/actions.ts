"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parsearColagem, ingerirInteracoes, recasarOrfas, slugDoPerfil } from "@/lib/prospecting/linkedin";
import { registrarBaseProspeccao } from "@/lib/lgpd/consentimento";
import { emailCorporativo } from "@/lib/lgpd/corporativo";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return { svc: createServiceClient(), m };
}

export async function salvarPost(dados: { url: string; titulo: string; temaIa: boolean; publicadoEm: string }) {
  const { svc } = await exigirAdmin();
  if (!dados.titulo.trim()) throw new Error("Dê um título ao post, para reconhecê-lo depois.");
  const { error } = await svc.from("linkedin_posts").insert({
    url: dados.url.trim() || null, titulo: dados.titulo.trim(),
    tema_ia: dados.temaIa, publicado_em: dados.publicadoEm || null,
  });
  if (error) throw new Error(error.message);
  await audit("linkedin.post.criado", "linkedin_posts", undefined, { titulo: dados.titulo });
  revalidatePath("/admin/prospeccao/sinais-linkedin");
}

/**
 * Recebe a lista colada do LinkedIn e ingere.
 *
 * Devolve o resultado em números que significam algo para quem colou: quantas pessoas entraram,
 * quantas já estavam na base (essas ganham o sinal na hora), e quantas linhas não deram para ler.
 */
export async function ingerirColagem(dados: {
  postId: string; tipo: "curtida" | "comentario" | "compartilhamento"; texto: string;
}): Promise<string> {
  await exigirAdmin();
  if (!dados.postId) throw new Error("Escolha o post.");
  const { linhas, ignoradas } = parsearColagem(dados.texto, dados.tipo);
  if (linhas.length === 0) {
    throw new Error("Não reconheci nenhuma pessoa no texto colado. Copie a lista de reações direto do LinkedIn — uma pessoa por linha.");
  }
  const r = await ingerirInteracoes(dados.postId, linhas, "manual");
  revalidatePath("/admin/prospeccao/sinais-linkedin");

  const partes = [`${r.gravadas} pessoa(s) registrada(s)`];
  if (r.casadas) partes.push(`${r.casadas} já estava(m) na base e ganhou(aram) o sinal`);
  if (r.repetidas) partes.push(`${r.repetidas} já constava(m) deste post`);
  if (ignoradas + r.ignoradas) partes.push(`${ignoradas + r.ignoradas} linha(s) não deram para ler`);
  return partes.join(" · ") + ".";
}

/** Recasa quem interagiu antes de entrar na base — a pessoa mais interessante da lista. */
export async function recasar(): Promise<string> {
  await exigirAdmin();
  const n = await recasarOrfas();
  revalidatePath("/admin/prospeccao/sinais-linkedin");
  return n === 0
    ? "Ninguém novo para casar por enquanto."
    : `${n} interação(ões) casada(s) com prospects que entraram depois.`;
}

/**
 * Vira prospect a partir de quem interagiu e ainda não está na base.
 *
 * Sem e-mail o registro nasce sem canal de contato — o que é aceitável aqui, diferente da coleta
 * do Apollo: esta pessoa **procurou o conteúdo do André por conta própria**, então guardar o
 * perfil profissional dela para uma abordagem tem finalidade clara. O e-mail entra depois, pelo
 * enriquecimento, e continua valendo a regra do dado corporativo.
 */
export async function virarProspect(interacaoId: string) {
  const { svc } = await exigirAdmin();
  const { data: i } = await svc.from("linkedin_interacoes")
    .select("id, nome, cargo, empresa, perfil_url, perfil_slug, prospect_id").eq("id", interacaoId).single();
  if (!i) throw new Error("Interação não encontrada.");
  if (i.prospect_id) throw new Error("Esta pessoa já está na base.");

  const { data: novo, error } = await svc.from("prospects").insert({
    name: i.nome, title: i.cargo, linkedin_url: i.perfil_url,
    procedencia: "coleta_publica", source: "linkedin", status: "novo", score: 0,
  }).select("id").single();
  if (error) throw new Error(error.message);

  await svc.from("linkedin_interacoes")
    .update({ prospect_id: novo.id, casado_em: new Date().toISOString() }).eq("id", interacaoId);

  await audit("linkedin.prospect.criado", "prospects", novo.id, { nome: i.nome, slug: i.perfil_slug });
  revalidatePath("/admin/prospeccao/sinais-linkedin");
}

/** Registra a base legal quando o e-mail aparecer — o prospect vindo do LinkedIn nasce sem ele. */
export async function registrarEmail(prospectId: string, email: string) {
  const { svc } = await exigirAdmin();
  const alvo = email.trim().toLowerCase();
  if (!emailCorporativo(alvo)) {
    throw new Error(`${alvo} é caixa pessoal. A prospecção só trata e-mail corporativo.`);
  }
  const { error } = await svc.from("prospects").update({ email: alvo }).eq("id", prospectId);
  if (error) throw new Error(error.message);
  await registrarBaseProspeccao({ email: alvo, origem: "interação em post do LinkedIn" });
  revalidatePath("/admin/prospeccao/sinais-linkedin");
}

export { slugDoPerfil };
