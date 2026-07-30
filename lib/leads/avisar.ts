import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { notifyMany } from "@/lib/notifications/notify";
import { auditService } from "@/lib/audit";
import { promoverLead, registrarToque, campanhaAtivaPara } from "./promover";
import { registrarConsentimentoDeLead } from "@/lib/lgpd/consentimento";
import { dispararGatilho } from "@/lib/agents/gatilhos";

/**
 * Aviso de lead novo: e-mail (Resend) + notificação no app.
 *
 * Vive aqui, e não na rota, porque dois caminhos chegam nele: o site avisando na hora, e a
 * varredura de cron que pega o que a chamada imediata perdeu. Uma implementação só evita o
 * cenário em que o caminho rápido funciona e o de recuperação manda formato diferente.
 *
 * `notificado_em` é o que garante idempotência: marcado ANTES do envio. Se o e-mail falhar, o
 * lead não é reavisado em loop pela varredura — melhor um aviso perdido, com o lead salvo e
 * visível na tela, do que o mesmo lead avisado vinte vezes.
 */

export type TabelaLead = "site_leads" | "andrekachan_leads";

const ORIGEM_LABEL: Record<TabelaLead, string> = {
  site_leads: "salestrack.com.br",
  andrekachan_leads: "andrekachan.com.br",
};

type Lead = {
  id: string; name: string | null; email: string; whatsapp?: string | null;
  empresa?: string | null; message?: string | null; source?: string | null; created_at: string;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Avisa um lead. Devolve false se já havia sido avisado (não é erro). */
export async function avisarLead(tabela: TabelaLead, leadId: string): Promise<boolean> {
  const sb = createServiceClient();

  const { data: lead } = await sb.from(tabela)
    .select("id, name, email, whatsapp, empresa, message, source, created_at, notificado_em")
    .eq("id", leadId).maybeSingle();
  if (!lead) return false;
  if ((lead as { notificado_em: string | null }).notificado_em) return false;

  // marca antes de enviar: evita reenvio em loop se o envio falhar
  await sb.from(tabela).update({ notificado_em: new Date().toISOString() }).eq("id", leadId);

  const l = lead as unknown as Lead;
  const origem = l.source || ORIGEM_LABEL[tabela];
  const quem = l.name?.trim() || l.email;

  const linhas: [string, string | null | undefined][] = [
    ["Nome", l.name], ["E-mail", l.email], ["WhatsApp", l.whatsapp],
    ["Empresa", l.empresa], ["Origem", origem],
  ];

  const corpoHtml = `
    <p style="margin:0 0 16px">Um lead novo entrou pelo <b>${esc(origem)}</b>.</p>
    <table style="border-collapse:collapse;width:100%">
      ${linhas.filter(([, v]) => v).map(([k, v]) => `
        <tr>
          <td style="padding:6px 12px 6px 0;color:#6B7A8D;font-size:13px;white-space:nowrap">${esc(k)}</td>
          <td style="padding:6px 0;color:#1E2A38;font-size:14px"><b>${esc(v)}</b></td>
        </tr>`).join("")}
    </table>
    ${l.message ? `<p style="margin:18px 0 6px;color:#6B7A8D;font-size:13px">O que a pessoa escreveu</p>
      <p style="margin:0;padding:12px 14px;background:#F7F8FA;border-radius:10px;color:#1E2A38;font-size:14px;line-height:1.6">${esc(l.message)}</p>` : ""}
    <p style="margin:18px 0 0;color:#6B7A8D;font-size:13px">Responda direto para <a href="mailto:${esc(l.email)}" style="color:#007A94">${esc(l.email)}</a>${l.whatsapp ? ` ou no WhatsApp ${esc(l.whatsapp)}` : ""}.</p>`;

  const destino = process.env.LEADS_EMAIL_TO
    ?? (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean)[0]
    ?? "andre.kachan@salestrack.com.br";

  const r = await sendEmail({
    to: destino,
    subject: `Novo lead · ${quem}`,
    title: "Novo lead",
    bodyHtml: corpoHtml,
    cta: { label: "Abrir o CRM", url: "https://ai-os-sable.vercel.app/admin/crm" },
  });
  if (!r.ok) console.warn(`[lead] e-mail de aviso não saiu para ${destino} (lead ${leadId})`);

  // notificação no app para todos os admins Salestrack
  const { data: admins } = await sb.from("memberships")
    .select("user_id, organizations!inner(is_salestrack)")
    .eq("role", "salestrack_admin").eq("organizations.is_salestrack", true);

  await notifyMany((admins ?? []).map((m) => m.user_id as string), {
    event: "new_lead",
    title: `Novo lead: ${quem}`,
    body: [l.empresa, origem].filter(Boolean).join(" · ") || origem,
    url: "/admin/crm",
    entityType: tabela,
    entityId: leadId,
  });

  /**
   * Promove a contato do CRM e credita a campanha, se houver uma ativa para esta origem.
   * Roda DEPOIS do aviso, de propósito: se a promoção falhar, o lead já foi comunicado e está
   * salvo. Avisar é urgente; entrar no CRM pode esperar a próxima passada.
   */
  try {
    const prom = await promoverLead(tabela, leadId);
    if (prom.status !== "ignorado") {
      const campanha = await campanhaAtivaPara(tabela);
      if (campanha) await registrarToque(prom.contactId, campanha, "formulario", `Lead de ${origem}`);
    }
    // O registro de consentimento é independente da promoção: mesmo lead que não virou contato
    // teve o dado tratado, e o que foi (ou não foi) autorizado precisa estar gravado.
    await registrarConsentimentoDeLead(tabela, leadId, prom.status === "ignorado" ? null : prom.contactId);
  } catch (e) {
    console.error(`[lead] promoção falhou para ${tabela}:${leadId}:`, (e as Error).message);
  }

  /**
   * Agentes inscritos em "lead novo" rodam por último, depois de avisar e promover. Se um agente
   * demorar ou falhar, o lead já está salvo, comunicado e no CRM — o trabalho principal não
   * depende dele.
   */
  await dispararGatilho("lead_novo", {
    nome: lead.name, email: lead.email, empresa: lead.empresa,
    mensagem: lead.message, origem,
  }, { tipo: tabela, id: leadId });

  await auditService("lead.avisado", tabela, leadId, { origem, email_ok: r.ok, degradado: r.degraded ?? false });
  return true;
}

/**
 * Varredura de recuperação: avisa o que ficou pendente.
 * Existe porque a chamada imediata do site pode falhar (rede, deploy em andamento, chave
 * errada) — e um lead sem aviso é um lead que ninguém vê.
 */
export async function avisarPendentes(limite = 20): Promise<{ tabela: TabelaLead; avisados: number }[]> {
  const sb = createServiceClient();
  const saida: { tabela: TabelaLead; avisados: number }[] = [];

  for (const tabela of ["site_leads", "andrekachan_leads"] as TabelaLead[]) {
    const { data } = await sb.from(tabela)
      .select("id").is("notificado_em", null).order("created_at").limit(limite);
    let n = 0;
    for (const row of data ?? []) if (await avisarLead(tabela, row.id as string)) n++;
    saida.push({ tabela, avisados: n });
  }
  return saida;
}
