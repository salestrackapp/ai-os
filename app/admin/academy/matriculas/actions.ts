"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ativarPorPagamento } from "@/lib/academy/matricula";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return { svc: createServiceClient(), m };
}

/** Preço e modo de venda do curso. Gratuito = qualquer um se matricula direto. */
export async function salvarPrecoCurso(courseId: string, dados: {
  gratuito: boolean; precoCentavos: number; checkoutUrl: string;
}) {
  const { svc } = await exigirAdmin();
  if (!dados.gratuito && dados.precoCentavos <= 0) {
    throw new Error("Um curso pago precisa de preço maior que zero.");
  }
  const { error } = await svc.from("academy_courses").update({
    gratuito: dados.gratuito,
    preco_centavos: dados.gratuito ? 0 : dados.precoCentavos,
    checkout_url: dados.checkoutUrl.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", courseId);
  if (error) throw new Error(error.message);

  await audit("academy.preco_curso", "academy_courses", courseId, dados);
  revalidatePath("/admin/academy/matriculas");
}

/**
 * Liberação gratuita: o admin dá acesso sem cobrar.
 *
 * Passa por `ativarPorPagamento` com provider 'manual' em vez de escrever a matrícula direto —
 * assim a cortesia deixa rastro em `academy_orders` (valor zero, status pago) e aparece nos
 * mesmos relatórios da venda. Cortesia sem registro vira buraco na contabilidade do curso.
 */
export async function liberarGratuitamente(courseId: string, email: string, nome: string) {
  const { svc, m } = await exigirAdmin();
  const alvo = email.trim().toLowerCase();
  if (!alvo) throw new Error("Informe o e-mail da pessoa.");

  const { data: lista } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const usuario = lista.users.find((u) => u.email?.toLowerCase() === alvo);
  if (!usuario) {
    throw new Error(`Não existe conta com o e-mail ${alvo}. A pessoa precisa criar a conta antes.`);
  }

  const { data: pedido, error } = await svc.from("academy_orders").insert({
    course_id: courseId, user_id: usuario.id, provider: "manual",
    valor_centavos: 0, status: "pendente", email: alvo,
  }).select("id").single();
  if (error) throw new Error(error.message);

  await ativarPorPagamento(pedido.id, "manual");

  // nome para o certificado: a matrícula criada pelo fluxo de pagamento não conhece o nome
  if (nome.trim()) {
    await svc.from("academy_enrollments").update({ nome: nome.trim() })
      .eq("course_id", courseId).eq("user_id", usuario.id);
  }

  await audit("academy.liberacao_gratuita", "academy_orders", pedido.id, { email: alvo, liberado_por: m.userId });
  revalidatePath("/admin/academy/matriculas");
  return { ok: true };
}

/** Revoga o acesso. Não apaga: cancela — o histórico e o certificado emitido permanecem. */
export async function cancelarMatricula(enrollmentId: string) {
  const { svc } = await exigirAdmin();
  const { error } = await svc.from("academy_enrollments").update({ status: "cancelada" }).eq("id", enrollmentId);
  if (error) throw new Error(error.message);
  await audit("academy.matricula_cancelada", "academy_enrollments", enrollmentId);
  revalidatePath("/admin/academy/matriculas");
}
