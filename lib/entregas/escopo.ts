import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

/**
 * O que foi vendido versus o que foi entregue.
 *
 * ── O buraco que isto fecha ───────────────────────────────────────────────────────────────────
 * A IMAGO tem contrato assinado, cinco faturas e uma jornada em andamento — e o sistema não sabia
 * responder "o que ela comprou, e o que já entregamos?". A proposta está aprovada com `items: []`,
 * e `deliverables` estava vazia desde que foi criada. Cobrar sem saber o que se deve entregar é o
 * lado que dá processo; entregar sem saber o que foi vendido é o lado que dá prejuízo.
 *
 * ── Por que não criei tabela nova ─────────────────────────────────────────────────────────────
 * `deliverables` já tinha exatamente a estrutura certa — frente, título, prazo, data de entrega,
 * artefato. Nunca tinha sido usada. Criar uma segunda tabela para o mesmo conceito é como o
 * sistema ganha dois lugares onde procurar a mesma resposta.
 *
 * ── A jornada continua sendo a jornada ────────────────────────────────────────────────────────
 * `journey_step_state` acompanha o PROCESSO (diagnóstico, kickoff, ativação). Isto acompanha o
 * COMPROMISSO (o que foi prometido no contrato). São perguntas diferentes: a jornada diz em que pé
 * está o projeto; o escopo diz se estamos devendo alguma coisa.
 */

export type Entrega = {
  id: string; org_id: string; project_id: string; contract_id: string | null;
  frente: string | null; title: string; status: string;
  due_date: string | null; delivered_at: string | null;
  origem: string; observacao: string | null;
};

export type LinhaEscopo = {
  id: string; titulo: string; frente: string | null; status: string;
  prazo: string | null; entregueEm: string | null;
  diasDeAtraso: number | null; observacao: string | null;
};

export type ResumoEscopo = {
  total: number; entregues: number; emAndamento: number; atrasadas: number; bloqueadas: number;
  percentual: number; linhas: LinhaEscopo[];
};

/** Atraso é dado objetivo: prazo no passado e sem data de entrega. Não depende de alguém marcar. */
function diasDeAtraso(e: Entrega): number | null {
  if (!e.due_date || e.delivered_at) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(e.due_date + "T00:00:00");
  const dias = Math.round((hoje.getTime() - prazo.getTime()) / 86400000);
  return dias > 0 ? dias : null;
}

export async function escopoDaOrg(orgId: string): Promise<ResumoEscopo> {
  const sb = createServiceClient();
  const { data } = await sb.from("deliverables")
    .select("id, org_id, project_id, contract_id, frente, title, status, due_date, delivered_at, origem, observacao")
    .eq("org_id", orgId).is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });

  const entregas = (data ?? []) as Entrega[];
  const linhas: LinhaEscopo[] = entregas.map((e) => ({
    id: e.id, titulo: e.title, frente: e.frente, status: e.status,
    prazo: e.due_date, entregueEm: e.delivered_at,
    diasDeAtraso: diasDeAtraso(e), observacao: e.observacao,
  }));

  const entregues = linhas.filter((l) => l.status === "entregue" || l.entregueEm).length;
  return {
    total: linhas.length,
    entregues,
    emAndamento: linhas.filter((l) => l.status === "em_andamento").length,
    atrasadas: linhas.filter((l) => l.diasDeAtraso !== null).length,
    bloqueadas: linhas.filter((l) => l.status === "bloqueado").length,
    // Zero de zero é 0%, não 100%: um contrato sem escopo cadastrado não está cumprido, está
    // sem escopo cadastrado — e a tela precisa dizer isso em vez de mostrar uma barra cheia.
    percentual: linhas.length ? Math.round((entregues / linhas.length) * 100) : 0,
    linhas,
  };
}

/** Quem está devendo entrega, em toda a base. É a leitura que abre a semana. */
export type OrgEmAtraso = {
  orgId: string; nome: string; atrasadas: number; piorAtraso: number; proximoPrazo: string | null;
};

export async function orgsComAtraso(): Promise<OrgEmAtraso[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("deliverables")
    .select("org_id, due_date, delivered_at, status, organizations(name)")
    .is("deleted_at", null).is("delivered_at", null).not("due_date", "is", null);

  const porOrg = new Map<string, OrgEmAtraso>();
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  for (const d of data ?? []) {
    const prazo = new Date((d.due_date as string) + "T00:00:00");
    const dias = Math.round((hoje.getTime() - prazo.getTime()) / 86400000);
    const orgId = d.org_id as string;
    const atual = porOrg.get(orgId) ?? {
      orgId, nome: (d.organizations as unknown as { name: string } | null)?.name ?? "—",
      atrasadas: 0, piorAtraso: 0, proximoPrazo: null,
    };
    if (dias > 0) {
      atual.atrasadas++;
      atual.piorAtraso = Math.max(atual.piorAtraso, dias);
    } else if (!atual.proximoPrazo || (d.due_date as string) < atual.proximoPrazo) {
      atual.proximoPrazo = d.due_date as string;
    }
    porOrg.set(orgId, atual);
  }

  return [...porOrg.values()]
    .filter((o) => o.atrasadas > 0)
    .sort((a, b) => b.piorAtraso - a.piorAtraso);
}

export async function registrarEntrega(dados: {
  orgId: string; projectId: string; contractId?: string | null;
  titulo: string; frente?: string | null; prazo?: string | null; observacao?: string | null;
}): Promise<string> {
  const sb = createServiceClient();
  const { data, error } = await sb.from("deliverables").insert({
    org_id: dados.orgId, project_id: dados.projectId, contract_id: dados.contractId ?? null,
    title: dados.titulo.trim(), frente: dados.frente ?? null,
    due_date: dados.prazo || null, observacao: dados.observacao ?? null,
    status: "planejado", origem: dados.contractId ? "contrato" : "manual",
  }).select("id").single();
  if (error) throw new Error(error.message);

  await auditService("entrega.criada", "deliverables", data.id, { titulo: dados.titulo }, dados.orgId);
  return data.id;
}

/**
 * Muda o estado de uma entrega e registra POR QUÊ.
 *
 * "entregue" carimba a data automaticamente, e sair de "entregue" a limpa: manter a data de
 * entrega de algo que voltou a ser trabalho em andamento é o tipo de resíduo que faz o relatório
 * mentir seis meses depois.
 *
 * O motivo é obrigatório ao TRAVAR e opcional nos demais. A regra vale no banco também
 * (`trg_entrega_evento_exige_motivo`), porque uma entrega travada sem explicação é a que ninguém
 * consegue destravar três semanas depois — e numa conversa de prazo não sustenta nada.
 *
 * O evento é gravado ANTES da mudança: se o gatilho recusar por falta de motivo, o status não
 * muda. Ao contrário, teríamos entrega travada sem registro de por quê — exatamente o que a regra
 * existe para impedir.
 */
export async function mudarStatusEntrega(id: string, status: string, motivo?: string | null, autor?: string | null): Promise<void> {
  const sb = createServiceClient();
  const { data: antes } = await sb.from("deliverables")
    .select("org_id, title, status").eq("id", id).single();
  if (!antes) throw new Error("Entrega não encontrada.");
  if (antes.status === status && !motivo) return;

  const { error: erroEvento } = await sb.from("deliverable_eventos").insert({
    deliverable_id: id, org_id: antes.org_id, de: antes.status, para: status,
    motivo: motivo?.trim() || null, autor: autor ?? null,
  });
  if (erroEvento) {
    throw new Error(/motivo/i.test(erroEvento.message)
      ? "Para travar uma entrega é preciso dizer o motivo — sem ele, ninguém consegue destravar depois."
      : erroEvento.message);
  }

  const patch: Record<string, unknown> = {
    status, updated_at: new Date().toISOString(), ultimo_motivo: motivo?.trim() || null,
  };
  patch.delivered_at = status === "entregue" ? new Date().toISOString() : null;

  const { error } = await sb.from("deliverables").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  await auditService("entrega.status", "deliverables", id,
    { de: antes.status, para: status, motivo: motivo ?? null, titulo: antes.title }, antes.org_id as string);
}

export type EventoEntrega = {
  de: string | null; para: string; motivo: string | null; quando: string;
};

/** Histórico de uma entrega — como ela chegou onde está. */
export async function historicoDaEntrega(id: string): Promise<EventoEntrega[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("deliverable_eventos")
    .select("de, para, motivo, created_at").eq("deliverable_id", id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((e) => ({
    de: e.de as string | null, para: e.para as string,
    motivo: e.motivo as string | null, quando: e.created_at as string,
  }));
}
