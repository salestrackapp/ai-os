import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { brl, BRAND_LABELS, proposalTotals, type ProposalItem, type TimelinePhase } from "@/lib/types";
import type { RoiMetrics } from "@/lib/agents/roi";
import type { DeliverableContent } from "./types";

const monthLabel = (iso?: string | null) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "";

/** Proposta (Fase 2) → conteúdo executivo com colunas duplas André Kachan × Salestrack. */
export async function composeProposal(proposalId: string): Promise<{ orgId: string; title: string; content: DeliverableContent }> {
  const sb = createServiceClient();
  const { data: p } = await sb.from("proposals").select("*").eq("id", proposalId).single();
  if (!p) throw new Error("Proposta não encontrada.");
  const items = (p.items ?? []) as ProposalItem[];
  const { byBrand, total } = proposalTotals(items);
  const ak = byBrand["andre_kachan"] ?? 0, st = byBrand["salestrack"] ?? 0, aios = byBrand["ai_os"] ?? 0;
  const inst = p.installments && p.installments > 1 ? p.installments : 1;
  const grand = total + aios;

  const sections: DeliverableContent["sections"] = [];
  sections.push({ id: "contexto", eyebrow: "Contexto", title: "Frentes do programa", bullets: (p.frentes ?? []) as string[], body: p.roi_note ?? undefined });
  sections.push({
    id: "investimento", eyebrow: "Investimento", title: "Composição do investimento",
    table: {
      head: ["Item", "Marca", "Qtd", "Unitário", "Total"],
      rows: items.map((it) => [it.name, BRAND_LABELS[it.brand] ?? it.brand, String(it.qty), brl(it.price), brl((Number(it.qty) || 0) * (Number(it.price) || 0))]),
      foot: ["Investimento total", "", "", "", brl(grand)],
    },
    kpis: [
      { label: "André Kachan", value: brl(ak), hint: "Conhecimento / método" },
      { label: "Salestrack AI", value: brl(st), hint: "Execução técnica" },
      { label: "Total", value: brl(grand), hint: inst > 1 ? `${inst}× de ${brl(grand / inst)}` : "à vista" },
    ],
  });
  const tl = (p.timeline ?? []) as TimelinePhase[];
  if (tl.length) sections.push({ id: "timeline", eyebrow: "Execução", title: "Linha do tempo", bullets: tl.map((f) => `Fase ${f.n} · ${f.titulo} (${f.meses} ${f.meses === 1 ? "mês" : "meses"}): ${f.descricao}`) });
  sections.push({
    id: "plataforma", eyebrow: "Plataforma", title: "Plataforma de IA do programa",
    body: p.platform_plan_md || "O programa opera sobre uma plataforma de IA corporativa (recomendação: Claude Team/Enterprise), entregue e operada via AI OS.",
    kpis: [{ label: "Mensalidade AI OS", value: brl(p.monthly_platform_fee ?? 0), hint: "recorrente / mês" }],
  });
  if (p.conditions_md) sections.push({ id: "condicoes", eyebrow: "Condições", title: "Condições comerciais", body: p.conditions_md });

  return {
    orgId: p.org_id, title: p.title,
    content: {
      cover: { eyebrow: "Proposta · André Kachan × Salestrack AI", title: p.title, subtitle: p.client_name ? `Preparada para ${p.client_name}` : undefined, meta: [p.version ? `Versão ${p.version}` : "", p.valid_until ? `Válida até ${new Date(p.valid_until + "T00:00:00").toLocaleDateString("pt-BR")}` : ""].filter(Boolean) },
      summary: p.roi_note ?? `Programa estruturado em ${(p.frentes ?? []).length} frentes, com investimento total de ${brl(grand)} e plataforma de IA operada pela Salestrack.`,
      sections,
      footer: "André Kachan · Salestrack AI",
    },
  };
}

/** ROI mensal (Fase 5, roi_reports) → relatório executivo do cliente (white-label). */
export async function composeRoi(roiReportId: string): Promise<{ orgId: string; title: string; content: DeliverableContent }> {
  const sb = createServiceClient();
  const { data: r } = await sb.from("roi_reports").select("*").eq("id", roiReportId).single();
  if (!r) throw new Error("Relatório de ROI não encontrado.");
  const { data: org } = await sb.from("organizations").select("name").eq("id", r.org_id).maybeSingle();
  const m = (r.metricas ?? {}) as Partial<RoiMetrics>;
  const kpis = [
    { label: "Receitas concluídas", value: String(m.playbook?.concluidas_mes ?? 0), hint: "no mês" },
    { label: "Usuários ativos", value: String(m.playbook?.usuarios_ativos ?? 0), hint: "no Playbook" },
    { label: "Sessões realizadas", value: String(m.sessoes?.realizadas_mes ?? 0), hint: `saldo ${m.sessoes?.creditos_saldo ?? 0} créditos` },
    { label: "Progresso do programa", value: `${m.programa?.progresso_pct ?? 0}%`, hint: m.programa?.fase ?? undefined },
  ];
  const sections: DeliverableContent["sections"] = [
    { id: "narrativa", eyebrow: "Balanço do mês", title: "Onde geramos valor", body: r.narrativa ?? "Narrativa a compor." },
  ];
  if (m.playbook?.por_trilha && Object.keys(m.playbook.por_trilha).length) {
    sections.push({ id: "trilhas", eyebrow: "Adoção", title: "Progresso por trilha", table: { head: ["Trilha", "Receitas concluídas"], rows: Object.entries(m.playbook.por_trilha).map(([k, v]) => [k, String(v)]) } });
  }
  return {
    orgId: r.org_id, title: `Relatório de ROI · ${monthLabel(r.periodo)}`,
    content: {
      cover: { eyebrow: "Relatório executivo de resultados", title: `Balanço de ${monthLabel(r.periodo)}`, subtitle: org?.name ?? undefined, meta: ["Programa de IA", monthLabel(r.periodo)] },
      summary: r.narrativa ? r.narrativa.split(/\n{2,}/)[0] : undefined,
      kpis, sections,
    },
  };
}

/** Dossiê de prospect (Fase 5.5) → one-pager de inteligência do decisor. */
export async function composeDossie(prospectId: string): Promise<{ orgId: string | null; title: string; content: DeliverableContent }> {
  const sb = createServiceClient();
  const { data: pr } = await sb.from("prospects").select("*, prospect_accounts(name, industry, domain, size)").eq("id", prospectId).single();
  if (!pr) throw new Error("Prospect não encontrado.");
  const acc = (pr as { prospect_accounts?: { name?: string; industry?: string; domain?: string; size?: string } }).prospect_accounts;
  const sections: DeliverableContent["sections"] = [
    { id: "dossie", eyebrow: "Inteligência", title: "Dossiê do decisor", body: pr.dossier_md || "Dossiê a compor a partir dos sinais coletados." },
  ];
  return {
    orgId: null, title: `Dossiê · ${pr.name}`,
    content: {
      cover: { eyebrow: "Salestrack AI · Inteligência comercial", title: pr.name, subtitle: [pr.title, acc?.name].filter(Boolean).join(" · "), meta: [acc?.industry, acc?.size, pr.icp ? pr.icp.toUpperCase() : "", pr.score != null ? `Score ${pr.score}` : ""].filter(Boolean) as string[] },
      kpis: [
        { label: "Score ICP", value: pr.score != null ? String(pr.score) : "—" },
        { label: "Senioridade", value: pr.seniority || "—" },
        { label: "Empresa", value: acc?.name || "—", hint: acc?.industry ?? undefined },
      ],
      sections, footer: "Salestrack AI",
    },
  };
}

/** Relatório de frente do programa (Fase 4a, deliverables) → avanço técnico. */
export async function composeFrente(projectId: string): Promise<{ orgId: string; title: string; content: DeliverableContent }> {
  const sb = createServiceClient();
  const { data: proj } = await sb.from("projects").select("id, org_id, name, phase, progress_pct, status").eq("id", projectId).single();
  if (!proj) throw new Error("Projeto não encontrado.");
  const { data: dels } = await sb.from("deliverables").select("frente, title, status").eq("project_id", projectId);
  const byFrente: Record<string, { title: string; status: string }[]> = {};
  for (const d of dels ?? []) (byFrente[d.frente ?? "Geral"] ??= []).push({ title: d.title, status: String(d.status) });
  const done = (dels ?? []).filter((d) => String(d.status).startsWith("entregue")).length;
  const sections: DeliverableContent["sections"] = Object.entries(byFrente).map(([frente, list], i) => ({
    id: `frente-${i}`, eyebrow: "Frente", title: frente,
    table: { head: ["Entregável", "Status"], rows: list.map((x) => [x.title, x.status]) },
  }));
  return {
    orgId: proj.org_id, title: `Relatório de frente · ${proj.name}`,
    content: {
      cover: { eyebrow: "Salestrack AI · Execução do programa", title: proj.name, subtitle: proj.phase ?? undefined, meta: [proj.status ?? "", `${proj.progress_pct ?? 0}% concluído`].filter(Boolean) as string[] },
      kpis: [
        { label: "Progresso", value: `${proj.progress_pct ?? 0}%` },
        { label: "Entregáveis concluídos", value: `${done}/${(dels ?? []).length}` },
        { label: "Fase", value: proj.phase || "—" },
      ],
      sections, footer: "Salestrack AI",
    },
  };
}

/** Resumo executivo de sessão ao vivo (Fase 4b, sessions). */
export async function composeSessao(sessionId: string): Promise<{ orgId: string; title: string; content: DeliverableContent }> {
  const sb = createServiceClient();
  const { data: s } = await sb.from("sessions").select("*").eq("id", sessionId).single();
  if (!s) throw new Error("Sessão não encontrada.");
  const dt = s.scheduled_at ? new Date(s.scheduled_at).toLocaleString("pt-BR") : "";
  const actionItems = Array.isArray(s.action_items) ? (s.action_items as string[]) : [];
  const sections: DeliverableContent["sections"] = [
    { id: "resumo", eyebrow: "Ata", title: "Resumo da sessão", body: s.summary_md || "Resumo a compor." },
  ];
  if (actionItems.length) sections.push({ id: "acoes", eyebrow: "Próximos passos", title: "Itens de ação", bullets: actionItems });
  return {
    orgId: s.org_id, title: `Resumo · ${s.title || "Sessão ao Vivo"}`,
    content: {
      cover: { eyebrow: "André Kachan · Sessão ao Vivo", title: s.title || "Sessão ao Vivo", subtitle: dt || undefined, meta: [dt].filter(Boolean) as string[] },
      summary: s.summary_md ? s.summary_md.split(/\n{2,}/)[0] : undefined,
      sections, footer: "André Kachan · Salestrack AI",
    },
  };
}
