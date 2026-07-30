"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { inventarioTitular, excluirTitular } from "@/lib/lgpd/titular";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return { svc: createServiceClient(), m };
}

export type FichaTitular = {
  email: string;
  contatos: { nome: string; empresa: string | null; desde: string }[];
  negocios: { titulo: string; etapa: string; criadoEm: string }[];
  leads: { origem: string; quando: string; mensagem: string | null }[];
  prospeccao: number;
  envios: { canal: string; status: string; quando: string }[];
  toques: number;
  consentimentos: { finalidade: string; estado: string; base: string; quando: string | null }[];
  vazio: boolean;
};

/**
 * Traduz o inventário cru do banco numa FICHA legível.
 *
 * A pessoa que atende um pedido de titular é do jurídico ou do comercial, não do time de
 * engenharia — e a resposta que ela vai mandar ao titular tem que sair daqui pronta para ler.
 * O objeto do banco nunca chega à tela.
 */
function montarFicha(inv: Record<string, unknown> | null, email: string): FichaTitular {
  const arr = (k: string) => (Array.isArray(inv?.[k]) ? (inv![k] as Record<string, unknown>[]) : []);
  const txt = (v: unknown) => (typeof v === "string" ? v : null);

  const leads = [
    ...arr("leads_site").map((l) => ({ origem: "salestrack.com.br", l })),
    ...arr("leads_andrekachan").map((l) => ({ origem: "andrekachan.com.br", l })),
  ].map(({ origem, l }) => ({
    origem,
    quando: String(l.created_at ?? ""),
    mensagem: txt(l.message),
  }));

  const ficha: FichaTitular = {
    email,
    contatos: arr("contatos").map((c) => ({
      nome: String(c.name ?? "sem nome"),
      empresa: txt(c.company) ?? txt(c.empresa),
      desde: String(c.created_at ?? ""),
    })),
    negocios: arr("negocios").map((d) => ({
      titulo: String(d.titulo ?? ""), etapa: String(d.etapa ?? ""), criadoEm: String(d.criado_em ?? ""),
    })),
    leads,
    prospeccao: arr("prospeccao").length,
    envios: arr("envios").map((e) => ({
      canal: String(e.canal ?? ""), status: String(e.status ?? ""), quando: String(e.em ?? ""),
    })),
    toques: Number(inv?.toques_campanha ?? 0),
    consentimentos: arr("consentimentos").map((c) => ({
      finalidade: String(c.finalidade ?? ""), estado: String(c.estado ?? ""),
      base: String(c.base_legal ?? ""), quando: txt(c.concedido_em) ?? txt(c.created_at),
    })),
    vazio: false,
  };
  ficha.vazio = ficha.contatos.length === 0 && ficha.negocios.length === 0 && ficha.leads.length === 0
    && ficha.prospeccao === 0 && ficha.envios.length === 0 && ficha.consentimentos.length === 0;
  return ficha;
}

/** Consulta o que existe sobre uma pessoa. Não altera nada — é o passo antes de decidir. */
export async function consultarTitular(email: string): Promise<FichaTitular> {
  await exigirAdmin();
  const alvo = email.trim().toLowerCase();
  if (!alvo) throw new Error("Informe o e-mail do titular.");
  const inv = await inventarioTitular(alvo);
  return montarFicha(inv, alvo);
}

export async function registrarPedido(dados: {
  tipo: string; email: string; nome: string; detalhe: string;
}) {
  const { svc } = await exigirAdmin();
  const email = dados.email.trim().toLowerCase();
  if (!email) throw new Error("Informe o e-mail de quem fez o pedido.");
  if (!dados.tipo) throw new Error("Escolha o tipo de pedido.");

  // O inventário é tirado no recebimento e fica anexado ao pedido: é a fotografia do que existia
  // quando a pessoa pediu, e é o que sustenta a resposta depois que os dados forem apagados.
  const inv = await inventarioTitular(email);

  const { data, error } = await svc.from("dsr_requests").insert({
    tipo: dados.tipo, email, nome: dados.nome.trim() || null,
    detalhe: dados.detalhe.trim() || null, inventario: inv,
  }).select("id").single();
  if (error) throw new Error(error.message);

  await audit("lgpd.pedido.registrado", "dsr_requests", data.id, { tipo: dados.tipo, email });
  revalidatePath("/admin/lgpd");
}

/**
 * Conclui o pedido. Quando é de exclusão, EXECUTA a exclusão — concluir um pedido de exclusão
 * sem apagar nada seria registrar uma mentira no próprio livro de conformidade.
 */
export async function concluirPedido(id: string, resposta: string) {
  const { svc, m } = await exigirAdmin();
  const { data: p } = await svc.from("dsr_requests").select("tipo, email, status").eq("id", id).single();
  if (!p) throw new Error("Pedido não encontrado.");
  if (p.status === "concluido") throw new Error("Este pedido já foi concluído.");

  let extra = "";
  if (p.tipo === "exclusao" || p.tipo === "revogacao") {
    const r = await excluirTitular(p.email as string);
    if (!r) throw new Error("A exclusão falhou. O pedido continua aberto — nada foi apagado pela metade.");
    extra = " Os dados foram apagados; a trilha de auditoria e os documentos com valor contratual foram preservados e anonimizados.";
  }

  const { error } = await svc.from("dsr_requests").update({
    status: "concluido", concluido_em: new Date().toISOString(),
    resposta: (resposta.trim() || "Atendido.") + extra,
    atendido_por: m.userId, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(error.message);

  await audit("lgpd.pedido.concluido", "dsr_requests", id, { tipo: p.tipo, email: p.email });
  revalidatePath("/admin/lgpd");
}

/** Exclusão avulsa, sem pedido formal — para quando a pessoa pede por telefone ou no corredor. */
export async function excluirAgora(email: string): Promise<string> {
  const { svc, m } = await exigirAdmin();
  const alvo = email.trim().toLowerCase();
  if (!alvo) throw new Error("Informe o e-mail do titular.");

  const { data } = await svc.from("dsr_requests").insert({
    tipo: "exclusao", email: alvo, status: "recebido",
    detalhe: "Pedido verbal registrado pela equipe Salestrack.",
    inventario: await inventarioTitular(alvo),
  }).select("id").single();

  const r = await excluirTitular(alvo);
  if (!r) throw new Error("A exclusão falhou. Nada foi apagado.");

  if (data?.id) {
    await svc.from("dsr_requests").update({
      status: "concluido", concluido_em: new Date().toISOString(), atendido_por: m.userId,
      resposta: "Dados apagados. Auditoria e documentos contratuais preservados e anonimizados.",
    }).eq("id", data.id);
  }
  await audit("lgpd.titular.excluido", "dsr_requests", data?.id, { email: alvo });
  revalidatePath("/admin/lgpd");
  return "Dados apagados.";
}
