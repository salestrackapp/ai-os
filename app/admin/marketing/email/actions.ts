"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { templatePorSlug } from "@/lib/marketing/templates";
import { montarAudiencia, suprimir, type Segmento } from "@/lib/marketing/audiencia";
import { enviarTeste, dispararCampanha } from "@/lib/marketing/disparo";
import type { Bloco } from "@/lib/marketing/blocos";

async function admin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas a equipe Salestrack.");
  return m;
}

const BASE = "/admin/marketing/email";

export async function criarCampanha(formData: FormData): Promise<void> {
  const m = await admin();
  const nome = String(formData.get("nome") ?? "").trim() || "Campanha sem nome";
  const slug = String(formData.get("template") ?? "").trim();
  const t = slug ? templatePorSlug(slug) : undefined;

  const sb = createServiceClient();
  const { data } = await sb.from("email_campanhas").insert({
    nome,
    assunto: t?.assunto ?? "",
    preheader: t?.preheader ?? null,
    blocos: t?.blocos ?? [],
    template_slug: t?.slug ?? null,
    criada_por: m.userId,
  }).select("id").single();

  await audit("email_mkt.criar", "email_campanhas", data?.id, { nome, template: slug || null });
  revalidatePath(BASE);
}

export async function salvarCampanha(id: string, dados: {
  nome: string; assunto: string; preheader: string; blocos: Bloco[]; remetente: string; segmento: Segmento;
}): Promise<{ ok: boolean; erro?: string }> {
  await admin();
  const sb = createServiceClient();
  const { data: c } = await sb.from("email_campanhas").select("status").eq("id", id).maybeSingle();
  if (!c) return { ok: false, erro: "Campanha não encontrada." };

  /**
   * Campanha enviada não se edita.
   *
   * O que saiu já está na caixa das pessoas; deixar editar depois criaria um registro que não
   * corresponde ao que foi recebido — e é justamente esse registro que responde "o que exatamente
   * mandamos para essa lista?" quando alguém pergunta.
   */
  if (["enviando", "enviada"].includes(c.status as string)) {
    return { ok: false, erro: "Esta campanha já saiu. Duplique-a para criar uma nova versão." };
  }

  await sb.from("email_campanhas").update({
    nome: dados.nome, assunto: dados.assunto, preheader: dados.preheader || null,
    blocos: dados.blocos, remetente: dados.remetente || null, segmento: dados.segmento,
    // Editar depois de aprovada derruba a aprovação: quem aprovou não aprovou isto.
    status: c.status === "aprovada" ? "rascunho" : c.status,
    aprovada_por: c.status === "aprovada" ? null : undefined,
    aprovada_em: c.status === "aprovada" ? null : undefined,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  revalidatePath(`${BASE}/${id}`);
  return { ok: true };
}

export async function testarCampanha(id: string, para: string): Promise<{ ok: boolean; erro?: string }> {
  await admin();
  const alvo = para.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alvo)) return { ok: false, erro: "Informe um e-mail válido." };
  const r = await enviarTeste(id, alvo);
  revalidatePath(`${BASE}/${id}`);
  return r;
}

/**
 * Manda para aprovação. Quem cria não aprova a própria campanha quando há mais de um admin —
 * mas com equipe de uma pessoa isso travaria tudo, então a regra é registrar, não impedir.
 */
export async function enviarParaAprovacao(id: string): Promise<{ ok: boolean; erro?: string }> {
  await admin();
  const sb = createServiceClient();
  const { data: c } = await sb.from("email_campanhas").select("assunto, blocos, status").eq("id", id).maybeSingle();
  if (!c) return { ok: false, erro: "Campanha não encontrada." };
  if (!String(c.assunto ?? "").trim()) return { ok: false, erro: "A campanha precisa de um assunto." };
  if (!Array.isArray(c.blocos) || !c.blocos.length) return { ok: false, erro: "A campanha está sem conteúdo." };

  await sb.from("email_campanhas").update({ status: "aguardando_aprovacao", updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(`${BASE}/${id}`);
  return { ok: true };
}

export async function aprovarCampanha(id: string): Promise<{ ok: boolean; erro?: string }> {
  const m = await admin();
  const sb = createServiceClient();
  const { data: c } = await sb.from("email_campanhas").select("status").eq("id", id).maybeSingle();
  if (c?.status !== "aguardando_aprovacao") return { ok: false, erro: "Só campanha aguardando aprovação pode ser aprovada." };

  await sb.from("email_campanhas").update({
    status: "aprovada", aprovada_por: m.userId, aprovada_em: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", id);
  await audit("email_mkt.aprovar", "email_campanhas", id, null);
  revalidatePath(`${BASE}/${id}`);
  return { ok: true };
}

/**
 * O disparo. Exige a confirmação escrita do número de destinatários.
 *
 * Não é burocracia: é a última chance de alguém perceber que a lista tem 4 mil pessoas quando
 * esperava 40. Botão de "enviar" com confirmação de "tem certeza?" ninguém lê — digitar o número
 * obriga a olhar para ele.
 */
export async function dispararAction(id: string, confirmacao: string): Promise<{ ok: boolean; erro?: string; enviados?: number; falhas?: number }> {
  const m = await admin();
  const { data: c } = await createServiceClient().from("email_campanhas").select("segmento, status").eq("id", id).maybeSingle();
  if (!c) return { ok: false, erro: "Campanha não encontrada." };
  if (c.status !== "aprovada") return { ok: false, erro: "Aprove a campanha antes de disparar." };

  const { destinatarios } = await montarAudiencia((c.segmento ?? {}) as Segmento);
  if (!destinatarios.length) return { ok: false, erro: "Nenhum destinatário pode receber esta campanha agora." };
  if (confirmacao.trim() !== String(destinatarios.length)) {
    return { ok: false, erro: `Digite ${destinatarios.length} para confirmar o envio a ${destinatarios.length} pessoa(s).` };
  }

  const r = await dispararCampanha(id, m.userId);
  revalidatePath(`${BASE}/${id}`);
  revalidatePath(BASE);
  return { ok: !r.erro, erro: r.erro, enviados: r.enviados, falhas: r.falhas };
}

export async function duplicarCampanha(id: string): Promise<void> {
  const m = await admin();
  const sb = createServiceClient();
  const { data: c } = await sb.from("email_campanhas").select("*").eq("id", id).maybeSingle();
  if (!c) return;
  await sb.from("email_campanhas").insert({
    nome: `${c.nome} (cópia)`, assunto: c.assunto, preheader: c.preheader, blocos: c.blocos,
    template_slug: c.template_slug, remetente: c.remetente, segmento: c.segmento, criada_por: m.userId,
  });
  revalidatePath(BASE);
}

export async function arquivarCampanha(id: string): Promise<void> {
  await admin();
  await createServiceClient().from("email_campanhas")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await audit("email_mkt.arquivar", "email_campanhas", id, null);
  revalidatePath(BASE);
}

export async function suprimirEndereco(formData: FormData): Promise<void> {
  await admin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  await suprimir(email, "manual", "Bloqueado pela equipe.");
  await audit("email_mkt.suprimir", "email_supressao", undefined, { email });
  revalidatePath(`${BASE}/lista`);
}
