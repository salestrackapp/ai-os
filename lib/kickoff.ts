import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { notifyAdmin } from "@/lib/whatsapp";
import { stripeConfigured, startBillingStripe } from "@/lib/stripe";
import { brl, type ProposalItem } from "@/lib/types";

type Step = { step: string; done: boolean; at: string | null; note?: string };

function sessionType(name: string): string | null {
  const n = name.toLowerCase();
  if (/estrat/.test(n)) return "sessao_estrategica";
  if (/sprint/.test(n)) return "sprint_30d";
  if (/trimestral/.test(n)) return "mentoria_trimestral";
  if (/workshop/.test(n)) return "workshop";
  if (/palestra/.test(n)) return "palestra";
  if (/trein/.test(n)) return "treinamento";
  if (/academy/.test(n)) return "ai_academy";
  if (/labs/.test(n)) return "ai_labs";
  if (/diagn/.test(n)) return "diagnostico_stack";
  return null;
}

/**
 * Kickoff idempotente do contrato assinado: project.created → org.activated →
 * stack.registered → session_credits.seeded → billing.started → notified.
 * Reexecutar não duplica nada (cada passo verifica o estado antes de agir).
 */
export async function runKickoff(contractId: string): Promise<{ ok: boolean; checklist: Step[] }> {
  const sb = createServiceClient();
  const now = () => new Date().toISOString();
  const { data: contract } = await sb.from("contracts").select("*").eq("id", contractId).single();
  if (!contract) throw new Error("Contrato não encontrado.");
  const { data: proposal } = await sb.from("proposals").select("*").eq("id", contract.proposal_id).single();
  const { data: org } = contract.org_id ? await sb.from("organizations").select("*").eq("id", contract.org_id).single() : { data: null };
  const items = (proposal?.items as ProposalItem[]) ?? [];
  const checklist: Step[] = [];
  let allOk = true;
  const run = async (step: string, fn: () => Promise<string | void>) => {
    try { const note = await fn(); checklist.push({ step, done: true, at: now(), note: note || undefined }); }
    catch (e) { allOk = false; checklist.push({ step, done: false, at: now(), note: (e as Error).message }); }
  };

  let projectId: string | null = null;
  // 1. project.created
  await run("project.created", async () => {
    const { data: existing } = await sb.from("projects").select("id").eq("contract_id", contractId).limit(1);
    if (existing && existing.length) { projectId = existing[0].id; return `reusado ${projectId}`; }
    const { data, error } = await sb.from("projects").insert({
      org_id: contract.org_id, contract_id: contractId,
      name: proposal?.title ?? "Programa", phase: "kickoff", status: "onboarding",
      timeline: proposal?.timeline ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    projectId = data.id; return `criado ${projectId}`;
  });

  // 2. org.activated
  await run("org.activated", async () => {
    if (!contract.org_id) return "sem org";
    await sb.from("organizations").update({ status: "onboarding" }).eq("id", contract.org_id);
    await sb.from("tenant_branding").upsert({ org_id: contract.org_id, level: "n1_padrao" }, { onConflict: "org_id" });
    return "onboarding + branding N1";
  });

  // 3. stack.registered
  await run("stack.registered", async () => {
    if (!contract.org_id) return "sem org";
    await sb.from("claude_workspaces").upsert({ org_id: contract.org_id, contract_status: "pendente" }, { onConflict: "org_id" });
    return "claude_workspaces pendente";
  });

  // 4. session_credits.seeded
  await run("session_credits.seeded", async () => {
    if (!contract.org_id) return "sem org";
    const byType: Record<string, number> = {};
    // créditos de sessão são das sessões ao vivo André Kachan (conhecimento), não dos produtos de execução
    for (const it of items) { if (it.brand !== "andre_kachan") continue; const t = sessionType(it.name); if (t) byType[t] = (byType[t] ?? 0) + (Number(it.qty) || 1); }
    const types = Object.keys(byType);
    for (const t of types) await sb.from("session_credits").upsert({ org_id: contract.org_id, type: t, total: byType[t] }, { onConflict: "org_id,type" });
    return `${types.length} tipo(s) de crédito`;
  });

  // 5. billing.started
  await run("billing.started", async () => {
    const total = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const inst = proposal?.installments && proposal.installments > 1 ? proposal.installments : 1;
    const monthly = proposal?.monthly_platform_fee ?? 0;
    // idempotência: se já há faturas deste contrato, não recria
    const { data: existingInv } = await sb.from("invoices").select("id").eq("contract_id", contractId).limit(1);
    if (existingInv && existingInv.length) return "já emitido";

    if (stripeConfigured() && contract.org_id) {
      const r = await startBillingStripe({ orgName: org?.name ?? "Cliente", email: proposal?.client_email, existingCustomerId: org?.stripe_customer_id, total, installments: inst, monthlyFee: monthly });
      if (r.customerId && !org?.stripe_customer_id) await sb.from("organizations").update({ stripe_customer_id: r.customerId }).eq("id", contract.org_id);
      for (const iv of r.invoices) await sb.from("invoices").insert({ org_id: contract.org_id, contract_id: contractId, kind: "implantacao", installment_n: iv.installmentN, installments_total: inst, amount: iv.amount, status: "aberta", due_date: iv.dueDate, stripe_invoice_id: iv.stripeId, hosted_url: iv.hostedUrl });
      if (r.subscription) await sb.from("subscriptions").insert({ org_id: contract.org_id, contract_id: contractId, plan: "professional", monthly_amount: r.subscription.amount, status: "ativa", stripe_subscription_id: r.subscription.stripeId });
      return `Stripe: ${r.invoices.length} faturas + assinatura`;
    }
    // Modo degradado: cria faturas/assinatura no banco como pendentes (para acompanhamento manual)
    if (contract.org_id) {
      const parcela = total / inst;
      for (let i = 1; i <= inst; i++) {
        const due = new Date(Date.now() + 30 * i * 86_400_000).toISOString().slice(0, 10);
        await sb.from("invoices").insert({ org_id: contract.org_id, contract_id: contractId, kind: "implantacao", installment_n: i, installments_total: inst, amount: parcela, status: "aberta", due_date: due });
      }
      if (monthly > 0) await sb.from("subscriptions").insert({ org_id: contract.org_id, contract_id: contractId, plan: "professional", monthly_amount: monthly, status: "ativa" });
    }
    return "manual pendente (sem Stripe)";
  });

  // grava checklist no projeto
  if (projectId) await sb.from("projects").update({ kickoff_checklist: checklist }).eq("id", projectId);

  // 6. notified
  const total = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const inst = proposal?.installments && proposal.installments > 1 ? proposal.installments : 1;
  await run("notified", async () => {
    await notifyAdmin(`✓ Kickoff ${org?.name ?? "cliente"}: projeto criado, ${inst} parcela(s) de implantação (${brl(total)}) e mensalidade ${brl(proposal?.monthly_platform_fee ?? 0)} ativa.`);
    return "admin notificado";
  });
  if (projectId) await sb.from("projects").update({ kickoff_checklist: checklist }).eq("id", projectId);

  await sb.from("contract_events").insert({ contract_id: contractId, kind: allOk ? "kickoff_ok" : "kickoff_erro", payload: { checklist } });
  await auditService(allOk ? "contract.kickoff_ok" : "contract.kickoff_erro", "contracts", contractId, { steps: checklist.map((c) => ({ step: c.step, done: c.done })) }, contract.org_id ?? undefined);
  return { ok: allOk, checklist };
}
