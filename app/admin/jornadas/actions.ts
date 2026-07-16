"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { currentMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { ensureJourneyStates, avancarJornada } from "@/lib/journey";
import { getOrCreateIntakeForOrg } from "@/lib/diagnostico";
import { canalWhatsApp, zapiConfigured } from "@/lib/whatsapp";
import { googleConfigured, sendGmail } from "@/lib/google";

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cliente";
/** Normaliza telefone BR: só dígitos; prefixa 55 quando parece nacional sem DDI. */
function normalizePhone(raw: string): string | null {
  const d = onlyDigits(raw);
  if (!d) return null;
  if (d.length >= 12) return d;               // já tem DDI
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}
async function origin(): Promise<string> {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}
async function diagLink(token: string): Promise<string> { return `${await origin()}/diagnostico/${token}`; }

/** Cria uma jornada inteira em 1 envio: org + contato + oportunidade + projeto(jornada) + diagnóstico. */
export async function criarJornadaAction(formData: FormData): Promise<{ ok: boolean; orgId?: string; token?: string; erro?: string }> {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) return { ok: false, erro: "Apenas a equipe Salestrack." };

  const empresa = String(formData.get("empresa") ?? "").trim();
  const contato = String(formData.get("contato") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  const oferta = String(formData.get("oferta") ?? "Fase 1 — Presença Digital + Agente IA 24h").trim();
  if (!empresa) return { ok: false, erro: "Informe o nome da empresa." };
  if (!contato) return { ok: false, erro: "Informe o nome do contato." };
  if (!whatsapp && !email) return { ok: false, erro: "Informe WhatsApp ou e-mail do contato." };

  const sb = createServiceClient();
  try {
    const slug = `${slugify(empresa)}-${Date.now().toString(36).slice(-4)}`;
    const { data: org, error: orgErr } = await sb.from("organizations")
      .insert({ name: empresa, slug, cnpj, plan: "essential", status: "onboarding", icp: 2, is_salestrack: false })
      .select("id").single();
    if (orgErr || !org) return { ok: false, erro: orgErr?.message ?? "Falha ao criar a empresa." };
    const orgId = org.id as string;

    const { data: contact } = await sb.from("contacts")
      .insert({ org_id: orgId, name: contato, email: email || null, phone: normalizePhone(whatsapp), role: "Contato principal", opt_in_whatsapp: true, opt_in_registered_at: new Date().toISOString() })
      .select("id").single();

    await sb.from("deals").insert({ org_id: orgId, contact_id: contact?.id ?? null, title: `${empresa} · ${oferta}`, stage: "qualificado", icp: 2, next_step: "Enviar o diagnóstico", last_activity_at: new Date().toISOString() });

    const { data: proj } = await sb.from("projects")
      .insert({ org_id: orgId, name: `${empresa} · Jornada`, phase: "implantacao", status: "ativo", progress_pct: 5, cycle_step: 0 })
      .select("id").single();
    if (proj?.id) await ensureJourneyStates(proj.id, 2); // começa no Diagnóstico

    const intake = await getOrCreateIntakeForOrg(orgId, `Diagnóstico Digital · ${empresa}`);
    await auditService("journey.criada", "organizations", orgId, { empresa, oferta }, orgId);
    revalidatePath("/admin/jornadas");
    return { ok: true, orgId, token: intake.token };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao criar a jornada." };
  }
}

/** Avança a etapa atual da jornada (conclui + ativa a próxima). */
export async function avancarJornadaAction(projectId: string) {
  await avancarJornada(projectId);
  revalidatePath("/admin/jornadas");
}

const msgDiag = (link: string) =>
  `Olá! Aqui é a Salestrack AI. Para começarmos, preencha este diagnóstico rápido da sua operação (leva poucos minutos): ${link}\n\nQualquer dúvida, é só responder por aqui. 🙂`;

/** Envia o link do diagnóstico por WhatsApp ao contato principal. */
export async function enviarDiagWhatsAppAction(orgId: string, token: string): Promise<{ ok: boolean; erro?: string }> {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) return { ok: false, erro: "Apenas a equipe." };
  if (!(await zapiConfigured())) return { ok: false, erro: "WhatsApp (Z-API) não conectado." };
  const sb = createServiceClient();
  const { data: c } = await sb.from("contacts").select("phone").eq("org_id", orgId).not("phone", "is", null).order("created_at").limit(1).maybeSingle();
  if (!c?.phone) return { ok: false, erro: "Contato sem telefone cadastrado." };
  const res = await canalWhatsApp().enviar(c.phone, msgDiag(await diagLink(token)), { org_id: orgId });
  return res.ok ? { ok: true } : { ok: false, erro: res.error ?? "Falha no envio." };
}

/** Envia o link do diagnóstico por e-mail ao contato principal. */
export async function enviarDiagEmailAction(orgId: string, token: string): Promise<{ ok: boolean; erro?: string }> {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) return { ok: false, erro: "Apenas a equipe." };
  if (!(await googleConfigured())) return { ok: false, erro: "Gmail não conectado." };
  const sb = createServiceClient();
  const { data: c } = await sb.from("contacts").select("email").eq("org_id", orgId).not("email", "is", null).order("created_at").limit(1).maybeSingle();
  if (!c?.email) return { ok: false, erro: "Contato sem e-mail cadastrado." };
  const link = await diagLink(token);
  const html = `<p>Olá!</p><p>Para começarmos, preencha este diagnóstico rápido da sua operação:</p><p><a href="${link}">${link}</a></p><p>Abraço,<br>Equipe Salestrack AI</p>`;
  const res = await sendGmail(c.email, "Diagnóstico Digital — Salestrack AI", html, { html: true });
  return res.sent ? { ok: true } : { ok: false, erro: "Falha no envio pelo Gmail." };
}
