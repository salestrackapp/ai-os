import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import type { TabelaLead } from "./avisar";

/**
 * Promove um lead a CONTATO do CRM, com a origem etiquetada.
 *
 * É o elo que faltava: o lead entrava numa tabela de captura e morria lá. Sem virar contato
 * ele não aparece no CRM, não recebe toque de campanha e nunca liga a um deal — ou seja, a
 * atribuição não teria o que atribuir.
 *
 * Dedupe por E-MAIL, não por linha de lead. A mesma pessoa preenchendo os dois sites é UMA
 * pessoa: o contato existente ganha a origem se ainda não tiver, mas não é duplicado nem
 * sobrescrito — a primeira origem é a que trouxe a pessoa, e é a que a atribuição deve creditar.
 *
 * `org_id` fica NULO: lead ainda não é cliente. `contacts.org_id` é nulável e a tabela é
 * admin-only, então isso não vaza para portal nenhum.
 */

const ORIGEM_POR_TABELA: Record<TabelaLead, string> = {
  site_leads: "salestrack-site",
  andrekachan_leads: "andrekachan-site",
};

export type ResultadoPromocao =
  | { status: "criado"; contactId: string }
  | { status: "ja_existia"; contactId: string }
  | { status: "ignorado"; motivo: string };

export async function promoverLead(tabela: TabelaLead, leadId: string): Promise<ResultadoPromocao> {
  const sb = createServiceClient();

  const { data: lead } = await sb.from(tabela)
    .select("id, name, email, whatsapp, empresa, message").eq("id", leadId).maybeSingle();
  if (!lead) return { status: "ignorado", motivo: "lead não encontrado" };

  const l = lead as { id: string; name: string | null; email: string; whatsapp: string | null; empresa: string | null; message: string | null };
  const email = (l.email ?? "").trim().toLowerCase();
  if (!email) return { status: "ignorado", motivo: "lead sem e-mail" };

  const leadRef = `${tabela}:${leadId}`;
  const { data: origem } = await sb.from("lead_sources")
    .select("id").eq("slug", ORIGEM_POR_TABELA[tabela]).maybeSingle();

  // Já existe contato com este e-mail?
  const { data: existente } = await sb.from("contacts")
    .select("id, lead_source_id, lead_ref").ilike("email", email).is("deleted_at", null).maybeSingle();

  if (existente) {
    // completa a origem só se estiver faltando — nunca reescreve a primeira
    if (!existente.lead_source_id && origem?.id) {
      await sb.from("contacts")
        .update({ lead_source_id: origem.id, lead_ref: existente.lead_ref ?? leadRef })
        .eq("id", existente.id);
    }
    await auditService("lead.promovido", "contacts", existente.id, { tabela, leadId, novo: false });
    return { status: "ja_existia", contactId: existente.id };
  }

  const { data: criado, error } = await sb.from("contacts").insert({
    org_id: null,
    name: l.name?.trim() || email,
    email,
    phone: l.whatsapp || null,
    lead_source_id: origem?.id ?? null,
    lead_ref: leadRef,
    origem_detalhe: [l.empresa, l.message?.slice(0, 200)].filter(Boolean).join(" · ") || null,
  }).select("id").single();

  if (error) {
    console.error(`[lead] falha ao promover ${leadRef}:`, error.message);
    return { status: "ignorado", motivo: error.message };
  }

  await auditService("lead.promovido", "contacts", criado.id, { tabela, leadId, novo: true });
  return { status: "criado", contactId: criado.id };
}

/**
 * Registra um toque de campanha para o contato. Usado quando o lead chega por uma campanha
 * ativa — é o que dá à atribuição algo para creditar.
 */
export async function registrarToque(contactId: string, campaignId: string, tipo = "formulario", detalhe?: string) {
  const sb = createServiceClient();
  const { error } = await sb.from("campaign_touches")
    .insert({ campaign_id: campaignId, contact_id: contactId, tipo, detalhe: detalhe ?? null });
  if (error) console.error(`[campanha] falha ao registrar toque:`, error.message);
}

/**
 * Campanha ativa da origem, se houver. Um lead que chega por um site durante uma campanha
 * daquele canal é creditado a ela — sem isso, toda campanha ficaria com zero toques mesmo
 * tendo gerado lead.
 */
export async function campanhaAtivaPara(tabela: TabelaLead): Promise<string | null> {
  const sb = createServiceClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from("campaigns")
    .select("id, lead_sources!inner(slug)")
    .eq("status", "ativa")
    .eq("lead_sources.slug", ORIGEM_POR_TABELA[tabela])
    .lte("inicio", hoje)
    .or(`fim.is.null,fim.gte.${hoje}`)
    .order("inicio", { ascending: false })
    .limit(1).maybeSingle();
  return data?.id ?? null;
}
