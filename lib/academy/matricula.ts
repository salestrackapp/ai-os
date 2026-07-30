import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

/**
 * Ativação de matrícula após pagamento — o ponto onde o pedido pago vira acesso.
 *
 * Vive aqui, e não no webhook, porque três caminhos chegam nele: o webhook do ASAAS, o do
 * Stripe e a liberação manual do admin. Uma implementação só evita que um deles esqueça
 * de marcar a matrícula e o aluno pague sem receber acesso.
 */
export async function ativarPorPagamento(orderId: string, provider: "asaas" | "stripe" | "manual") {
  const sb = createServiceClient();

  const { data: pedido } = await sb.from("academy_orders")
    .select("id, course_id, user_id, enrollment_id, status, email").eq("id", orderId).maybeSingle();
  if (!pedido) return { ok: false, motivo: "pedido não encontrado" };
  if (pedido.status === "pago") return { ok: true, motivo: "já estava pago" };   // idempotente

  await sb.from("academy_orders")
    .update({ status: "pago", pago_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", orderId);

  // a matrícula pode já existir como 'pendente' (aberta antes do checkout) ou não existir ainda
  const { data: existente } = await sb.from("academy_enrollments")
    .select("id, status").eq("course_id", pedido.course_id).eq("user_id", pedido.user_id).maybeSingle();

  let enrollmentId = existente?.id ?? null;
  if (existente) {
    if (existente.status === "pendente") {
      await sb.from("academy_enrollments").update({ status: "ativa" }).eq("id", existente.id);
    }
  } else {
    const { data: nova } = await sb.from("academy_enrollments").insert({
      course_id: pedido.course_id, user_id: pedido.user_id, org_id: null,
      origem: "individual", status: "ativa", email: pedido.email,
    }).select("id").single();
    enrollmentId = nova?.id ?? null;
  }

  if (enrollmentId && !pedido.enrollment_id) {
    await sb.from("academy_orders").update({ enrollment_id: enrollmentId }).eq("id", orderId);
  }

  await auditService("academy.matricula_liberada", "academy_orders", orderId, { provider, enrollmentId });
  return { ok: true, enrollmentId };
}
