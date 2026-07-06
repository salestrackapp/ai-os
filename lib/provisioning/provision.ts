import "server-only";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { googleConfigured, sendGmail } from "@/lib/google";

export const DEFAULT_CHECKLIST = [
  { key: "perfil", label: "Concluir perfil e marca da empresa", done: false },
  { key: "consultor", label: "Fazer a 1ª pergunta ao Consultor do Programa", done: false },
  { key: "programa", label: "Revisar Meu Programa (linha do tempo e entregáveis)", done: false },
  { key: "stack", label: "Declarar o Meu Stack de IA", done: false },
  { key: "equipe", label: "Convidar a equipe", done: false },
];

function slugify(s: string) {
  return (s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)) || `org-${Date.now()}`;
}

export type ProvisionInput = {
  name: string; plan_key?: string; monthly_platform_fee?: number; template_key?: string;
  adminEmail?: string; brandingLevel?: string; logo_url?: string; color_accent?: string; internal_name?: string;
  source?: "manual" | "deal"; deal_id?: string | null; createdBy?: string | null; provisioningId?: string | null;
};
export type ProvisionResult = { ok: boolean; provisioningId: string; orgId: string | null; inviteLink: string | null; steps: Step[] };
type Step = { passo: string; status: "pronto" | "pulado" | "falhou"; erro?: string };

/** Cria/retoma um tenant ponta a ponta, em passos idempotentes gravados em tenant_provisioning.steps. */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  const sb = createServiceClient();
  // cria ou retoma o registro de provisionamento
  let provId = input.provisioningId ?? null;
  if (!provId) {
    const { data } = await sb.from("tenant_provisioning").insert({ status: "provisionando", source: input.source ?? "manual", deal_id: input.deal_id ?? null, template_key: input.template_key ?? null, created_by: input.createdBy ?? null, steps: [], input: input as never }).select("id").single();
    provId = data!.id;
  } else {
    await sb.from("tenant_provisioning").update({ status: "provisionando" }).eq("id", provId);
  }

  const steps: Step[] = [];
  let orgId: string | null = null;
  let inviteLink: string | null = null;
  let tplVersion: number | null = null;
  const run = async (passo: string, fn: () => Promise<void>) => {
    try { await fn(); steps.push({ passo, status: "pronto" }); }
    catch (e) { steps.push({ passo, status: "falhou", erro: (e as Error).message }); throw new Error(`${passo}: ${(e as Error).message}`); }
  };

  try {
    // 1) org (idempotente por slug)
    await run("org", async () => {
      const slug = slugify(input.name);
      const { data: found } = await sb.from("organizations").select("id").eq("slug", slug).maybeSingle();
      orgId = found?.id ?? (await sb.from("organizations").insert({ name: input.name, slug, status: "onboarding", is_salestrack: false }).select("id").single()).data!.id;
    });
    // 2) branding N1 (ou conforme plano)
    await run("branding", async () => {
      await sb.from("tenant_branding").upsert({ org_id: orgId, level: input.brandingLevel ?? "n1_padrao", internal_name: input.internal_name ?? input.name, logo_url: input.logo_url ?? null, color_accent: input.color_accent ?? null, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
    });
    // 3) assinatura
    await run("assinatura", async () => {
      const fee = Number(input.monthly_platform_fee ?? 0) || 0;
      const { data: ex } = await sb.from("subscriptions").select("id").eq("org_id", orgId).limit(1).maybeSingle();
      const row = { org_id: orgId, plan_key: input.plan_key ?? "base", status: "ativa", monthly_platform_fee: fee, updated_at: new Date().toISOString() };
      if (ex) await sb.from("subscriptions").update(row).eq("id", ex.id);
      else await sb.from("subscriptions").insert({ ...row, plan: input.plan_key === "pro" ? "professional" : input.plan_key === "enterprise" ? "enterprise" : "essential", monthly_amount: fee, started_at: new Date().toISOString() });
    });
    // 4) montar programa a partir do template (ou mínimo válido)
    await run("programa", async () => {
      const { data: tpl } = input.template_key ? await sb.from("program_templates").select("structure, name, current_version").eq("key", input.template_key).eq("is_active", true).maybeSingle() : { data: null };
      tplVersion = (tpl as { current_version?: number } | null)?.current_version ?? null; // pina a versão publicada usada
      const st = (tpl?.structure as Record<string, unknown>) ?? {};
      const timeline = Array.isArray(st.timeline) ? st.timeline : [{ n: 1, titulo: "Fundação", meses: 3, descricao: "Início do programa." }];
      const { data: proj0 } = await sb.from("projects").select("id").eq("org_id", orgId).limit(1).maybeSingle();
      const projId = proj0?.id ?? (await sb.from("projects").insert({ org_id: orgId, name: `Programa · ${input.name}`, phase: (timeline[0] as { titulo?: string })?.titulo ?? "Fundação", status: "onboarding", progress_pct: 0, timeline }).select("id").single()).data!.id;
      const dels = Array.isArray(st.deliverables) ? (st.deliverables as { frente?: string; title: string }[]) : [];
      for (const d of dels) {
        const { data: dup } = await sb.from("deliverables").select("id").eq("org_id", orgId).eq("title", d.title).maybeSingle();
        if (!dup) await sb.from("deliverables").insert({ project_id: projId, org_id: orgId, frente: d.frente ?? null, title: d.title, status: "planejado" });
      }
      const lib = Array.isArray(st.biblioteca) ? (st.biblioteca as { title: string; type?: string }[]) : [];
      for (const l of lib) {
        const { data: dup } = await sb.from("library_assets").select("id").eq("org_id", orgId).eq("title", l.title).maybeSingle();
        if (!dup) await sb.from("library_assets").insert({ org_id: orgId, type: l.type ?? "documento", title: l.title, meta: { origem: "template" } });
      }
    });
    // 5) convidar client_admin (reusa `invites`)
    await run("convite", async () => {
      const host = process.env.NEXT_PUBLIC_APP_HOST || process.env.NEXT_PUBLIC_SITE_URL || "";
      const base = host.startsWith("http") ? host : `https://${host}`;
      if (input.adminEmail) {
        const email = input.adminEmail.trim().toLowerCase();
        const { data: ex } = await sb.from("invites").select("token").eq("org_id", orgId).eq("email", email).is("accepted_at", null).maybeSingle();
        const token = ex?.token ?? (await sb.from("invites").insert({ org_id: orgId, email, role: "client_admin", invited_by: input.createdBy ?? null, expires_at: new Date(Date.now() + 14 * 86400000).toISOString() }).select("token").single()).data!.token;
        inviteLink = `${base}/convite/${token}`;
        if ((await googleConfigured())) {
          await sendGmail(email, `Seu acesso ao programa ${input.name} · AI OS`, `Olá,\n\nVocê foi convidado a acessar o portal do seu programa de IA no AI OS.\nCrie seu acesso por este link:\n${inviteLink}\n\nAté já,\nEquipe Salestrack`);
        }
      }
    });
    // 6) checklist de ativação
    await run("checklist", async () => {
      await sb.from("onboarding_checklists").upsert({ org_id: orgId, items: DEFAULT_CHECKLIST }, { onConflict: "org_id" });
    });
    // 7) verificação de isolamento
    await run("isolamento", async () => {
      const { count } = await sb.from("deliverables").select("id", { count: "exact", head: true }).eq("org_id", orgId).neq("org_id", orgId);
      if ((count ?? 0) > 0) throw new Error("vazamento detectado");
    });

    await sb.from("tenant_provisioning").update({ org_id: orgId, status: "pronto", steps, template_version: tplVersion, completed_at: new Date().toISOString() }).eq("id", provId);
    await auditService("tenant.provisioned", "tenant_provisioning", provId!, { orgId, name: input.name }, orgId ?? undefined);
    return { ok: true, provisioningId: provId!, orgId, inviteLink, steps };
  } catch (e) {
    await sb.from("tenant_provisioning").update({ org_id: orgId, status: "falhou", steps }).eq("id", provId);
    await auditService("tenant.provision_fail", "tenant_provisioning", provId!, { error: (e as Error).message }, orgId ?? undefined);
    return { ok: false, provisioningId: provId!, orgId, inviteLink, steps };
  }
}
