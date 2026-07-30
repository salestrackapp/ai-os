"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return { svc: createServiceClient(), m };
}

/** Aceita "1.234,56" e "1234.56" — quem digita valor não deve ter de escolher o formato. */
function centavos(valor: string): number {
  const limpo = valor.trim().replace(/[R$\s]/g, "");
  const n = limpo.includes(",")
    ? Number(limpo.replace(/\./g, "").replace(",", "."))
    : Number(limpo);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Informe um valor válido, como 25,00.");
  return Math.round(n * 100);
}

export async function salvarFornecedor(dados: { nome: string; categoria: string; site: string }) {
  const { svc } = await exigirAdmin();
  if (!dados.nome.trim()) throw new Error("Informe o nome do fornecedor.");
  const { error } = await svc.from("vendors").insert({
    nome: dados.nome.trim(), categoria: dados.categoria, site: dados.site.trim() || null,
  });
  if (error) {
    throw new Error(/duplicate|unique/i.test(error.message)
      ? "Este fornecedor já está cadastrado." : error.message);
  }
  await audit("admin.fornecedor.criado", "vendors", undefined, { nome: dados.nome });
  revalidatePath("/admin/administracao");
}

export async function salvarDespesa(dados: {
  vendorId: string; descricao: string; valor: string; categoria: string;
  recorrencia: string; inicio: string; observacao: string;
}) {
  const { svc, m } = await exigirAdmin();
  if (!dados.descricao.trim()) throw new Error("Diga o que é a despesa.");

  const { error } = await svc.from("despesas").insert({
    vendor_id: dados.vendorId || null,
    descricao: dados.descricao.trim(),
    valor_centavos: centavos(dados.valor),
    categoria: dados.categoria,
    recorrencia: dados.recorrencia,
    inicio: dados.inicio,
    observacao: dados.observacao.trim() || null,
    responsavel: m.userId,
    // Nasce revisada: acabou de ser decidida. Marcá-la como "nunca revisada" no dia em que
    // entrou encheria a fila de revisão de coisas que ninguém precisa olhar ainda.
    revisada_em: new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  await audit("admin.despesa.criada", "despesas", undefined,
    { descricao: dados.descricao, recorrencia: dados.recorrencia });
  revalidatePath("/admin/administracao");
}

/** "Ainda preciso disto" — reinicia o relógio da revisão sem mudar mais nada. */
export async function revisarDespesa(id: string) {
  const { svc } = await exigirAdmin();
  await svc.from("despesas")
    .update({ revisada_em: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
    .eq("id", id);
  await audit("admin.despesa.revisada", "despesas", id);
  revalidatePath("/admin/administracao");
}

/**
 * Encerra a despesa. Não apaga: o histórico do que já se gastou é o que permite comparar um ano
 * com o outro, e apagar a linha some com o custo passado junto.
 */
export async function encerrarDespesa(id: string) {
  const { svc } = await exigirAdmin();
  await svc.from("despesas")
    .update({ ativa: false, fim: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
    .eq("id", id);
  await audit("admin.despesa.encerrada", "despesas", id);
  revalidatePath("/admin/administracao");
}
