import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Sugestão proativa: achado + ação. Derivada do estado real (nunca placeholder). */
export type Suggestion = { finding: string; label: string; href: string };

/** Admin — 1 a 3 sugestões por área, a partir do estado real. */
export async function adminNextActions(sb: SupabaseClient, areaKey: string): Promise<Suggestion[]> {
  const out: Suggestion[] = [];
  try {
    if (areaKey === "clientes") {
      const { count: orgs } = await sb.from("organizations").select("id", { count: "exact", head: true }).eq("is_salestrack", false);
      if ((orgs ?? 0) === 0) out.push({ finding: "Você ainda não tem clientes. Cadastre o primeiro para começar a operar o programa dele.", label: "Cadastrar cliente", href: "/admin/onboarding/novo" });
      else {
        const { count: onb } = await sb.from("projects").select("id", { count: "exact", head: true }).eq("status", "onboarding");
        if ((onb ?? 0) > 0) out.push({ finding: `${onb} ${onb === 1 ? "cliente ainda não ativou" : "clientes ainda não ativaram"} o portal.`, label: "Ver programas", href: "/admin/programas" });
      }
    } else if (areaKey === "comercial") {
      const { count: rasc } = await sb.from("proposals").select("id", { count: "exact", head: true }).eq("status", "rascunho");
      if ((rasc ?? 0) > 0) out.push({ finding: `${rasc} ${rasc === 1 ? "proposta em rascunho aguardando" : "propostas em rascunho aguardando"} envio.`, label: "Abrir propostas", href: "/admin/propostas" });
      const { count: deals } = await sb.from("deals").select("id", { count: "exact", head: true }).eq("stage", "sinal");
      if ((deals ?? 0) > 0 && out.length < 3) out.push({ finding: `Há ${deals} ${deals === 1 ? "sinal novo" : "sinais novos"} no funil para qualificar e abordar.`, label: "Abrir CRM", href: "/admin/crm" });
    } else if (areaKey === "estudio") {
      const { count: rev } = await sb.from("studio_deliverables").select("id", { count: "exact", head: true }).eq("status", "em_revisao");
      if ((rev ?? 0) > 0) out.push({ finding: `${rev} ${rev === 1 ? "entregável aguarda" : "entregáveis aguardam"} sua aprovação antes de ir ao cliente.`, label: "Revisar entregáveis", href: "/admin/entregaveis" });
    } else if (areaKey === "plataforma") {
      const { count: al } = await sb.from("alerts").select("id", { count: "exact", head: true }).neq("status", "resolvido");
      if ((al ?? 0) > 0) out.push({ finding: `${al} ${al === 1 ? "alerta aberto" : "alertas abertos"} em Operações pedindo atenção.`, label: "Ver operações", href: "/admin/operacoes" });
    } else if (areaKey === "metodo") {
      const { count: rev } = await sb.from("playbook_recipes").select("id", { count: "exact", head: true }).eq("needs_review", true);
      if ((rev ?? 0) > 0) out.push({ finding: `${rev} ${rev === 1 ? "receita precisa" : "receitas precisam"} de revisão de texto no Estúdio do Método.`, label: "Abrir Estúdio", href: "/admin/estudio" });
    }
  } catch { /* degradação graciosa: sem sugestão */ }
  return out.slice(0, 3);
}

/** Portal — sugestões por área, estritamente da org do cliente. */
export async function portalNextActions(sb: SupabaseClient, orgId: string, areaKey: string): Promise<Suggestion[]> {
  const out: Suggestion[] = [];
  try {
    if (areaKey === "visao") {
      const { data: roi } = await sb.from("roi_reports").select("periodo").eq("org_id", orgId).eq("publicado", true).order("periodo", { ascending: false }).limit(1).maybeSingle();
      if (roi?.periodo) out.push({ finding: `Seu relatório de ${new Date(roi.periodo + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} está pronto — veja o valor gerado.`, label: "Ver ROI", href: "/portal/roi" });
      const { count: ent } = await sb.from("studio_deliverables").select("id", { count: "exact", head: true }).eq("org_id", orgId).in("status", ["aprovado", "entregue"]);
      if ((ent ?? 0) > 0 && out.length < 3) out.push({ finding: `Você tem ${ent} ${ent === 1 ? "documento executivo pronto" : "documentos executivos prontos"} para baixar.`, label: "Ver entregáveis", href: "/portal/entregaveis" });
    } else if (areaKey === "automacoes") {
      const { data: s } = await sb.from("sessions").select("title, scheduled_at").eq("org_id", orgId).gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1).maybeSingle();
      if (s?.scheduled_at) out.push({ finding: `Sua próxima sessão ao vivo é ${new Date(s.scheduled_at).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.`, label: "Ver sessões", href: "/portal/sessoes" });
    } else if (areaKey === "copilotos") {
      out.push({ finding: "Seu Consultor pode resumir o andamento do programa e sugerir a próxima Receita.", label: "Falar com o Consultor", href: "/portal/consultor" });
    }
  } catch { /* degradação graciosa */ }
  return out.slice(0, 3);
}
