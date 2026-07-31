import type { Gatilho } from "./triggers";

/** Tipos de ativo do Estúdio que um passo da régua pode consumir (R3). */
export const ASSET_TYPES: { key: string; label: string; lines: string[]; message: boolean }[] = [
  { key: "email", label: "E-mail marketing", lines: ["email_mkt"], message: true },
  { key: "whatsapp", label: "Mensagem WhatsApp", lines: ["whatsapp"], message: true },
  { key: "post", label: "Post", lines: ["post"], message: true },
  { key: "mensagem", label: "Mensagem", lines: ["mensagem"], message: true },
  { key: "relatorio", label: "Relatório", lines: ["relatorio"], message: false },
  { key: "apresentacao", label: "Apresentação", lines: ["apresentacao"], message: false },
  { key: "video", label: "Vídeo", lines: ["video_roteiro"], message: false },
  { key: "arte", label: "Arte", lines: ["arte", "criativo_post"], message: false },
];
export function assetTypeLabel(k: string): string {
  return ASSET_TYPES.find((a) => a.key === k)?.label ?? k;
}
export function assetTypeIsMessage(k: string): boolean {
  return !!ASSET_TYPES.find((a) => a.key === k)?.message;
}

/** Um passo da régua (definição). */
export type ReguaStep = {
  id?: string;
  cycle_step: number;
  titulo: string;
  gatilho: Gatilho;
  asset_type: string;
  asset_ref?: string | null;
  timing?: Record<string, unknown>;
  publico?: string;
  ordem?: number;
  ativo?: boolean;
};

/** Linha mínima de um ativo do Estúdio (para o gate). */
export type AssetRow = { id: string; status: string; comm_eligible?: boolean | null } | null | undefined;

/**
 * GATE RÍGIDO (R4.1): um passo só fica "completo" (pronto para orquestrar em R4.3) quando tem um
 * ativo do Estúdio APROVADO e ELEGÍVEL. Sem asset_ref ou ativo não-aprovado → 'incompleto'.
 */
export function stepCompleteness(step: ReguaStep, asset: AssetRow): { status: "completo" | "incompleto"; motivo?: string } {
  if (!step.asset_ref) return { status: "incompleto", motivo: "Sem ativo vinculado." };
  if (!asset) return { status: "incompleto", motivo: "Ativo não encontrado." };
  if (!["aprovado", "publicado", "entregue"].includes(asset.status)) return { status: "incompleto", motivo: `Ativo não aprovado (${asset.status}).` };
  if (assetTypeIsMessage(step.asset_type) && !asset.comm_eligible) return { status: "incompleto", motivo: "Ativo não elegível para orquestração." };
  return { status: "completo" };
}

/**
 * O que este passo FAZ, na prática — inclusive quando a resposta é "nada".
 *
 * ── Por que existe ────────────────────────────────────────────────────────────────────────────
 * A régua padrão tem um passo "Reengajar se inativo", com gatilho de estado. O avaliador não
 * implementa gatilho de estado: `isDue` devolve `false` para ele, sempre. Ou seja, o passo aparece
 * na tela como qualquer outro, pode ser marcado como "completo", e nunca vai disparar — e não havia
 * nada, em lugar nenhum, dizendo isso a quem monta a régua.
 *
 * O mesmo vale para o público: um passo dirigido ao "admin" não manda nada, porque a régua fala com
 * o cliente. Melhor dizer na tela do que deixar a pessoa esperando por um envio que não vem.
 */
export type AvisoDoPasso = { grave: boolean; texto: string };

export function diagnosticarPasso(step: Pick<ReguaStep, "gatilho" | "asset_type" | "publico">): AvisoDoPasso[] {
  const avisos: AvisoDoPasso[] = [];
  const g = step.gatilho as { tipo?: string; quando?: string; offset_dias?: number };

  const cond = (step.gatilho as { condicao?: string })?.condicao;
  if (g?.tipo === "estado" && cond === "baixo_engajamento") {
    avisos.push({ grave: true, texto: "“Baixo engajamento” ainda não é avaliado pelo motor — este passo nunca vai disparar. Use inatividade, tempo ou evento." });
  }
  if (g?.tipo === "estado" && cond === "inatividade") {
    avisos.push({ grave: false, texto: "Conta como inatividade não entrar no Portal, não aparecer em sessão e não responder mensagem. Cliente que nunca teve atividade nenhuma não é cobrado." });
  }
  if (!assetTypeIsMessage(step.asset_type)) {
    avisos.push({ grave: true, texto: `“${assetTypeLabel(step.asset_type)}” não é um canal de envio — a régua só dispara e-mail e WhatsApp. Este passo fica como material de apoio.` });
  }
  if (step.publico === "admin") {
    avisos.push({ grave: true, texto: "Público “Admin”: a régua fala com o cliente e não envia nada para a equipe Salestrack. Use as notificações do sistema." });
  }
  if (step.publico === "cliente") {
    avisos.push({ grave: false, texto: "Vai só para quem tem papel de patrocinador ou administrador na conta do cliente — não para toda a equipe." });
  }
  if (g?.tipo === "tempo" && (g.offset_dias ?? 0) > 0) {
    avisos.push({ grave: false, texto: `Sai ${g.offset_dias} dia(s) depois do gatilho, não na hora.` });
  }
  return avisos;
}

/** Régua-template padrão (engajamento AI Operating System) — instanciada por programa. */
export const DEFAULT_REGUA_NOME = "Engajamento AI Operating System";
export const DEFAULT_REGUA_STEPS: ReguaStep[] = [
  { cycle_step: 0, titulo: "Boas-vindas ao programa", gatilho: { tipo: "evento", evento: "programa_provisionado" }, asset_type: "email", timing: { quando: "imediato" }, publico: "cliente", ordem: 0 },
  { cycle_step: 0, titulo: "Abertura — Diagnosticar", gatilho: { tipo: "tempo", quando: "apos_inicio_fase", offset_dias: 0 }, asset_type: "whatsapp", timing: { offset_dias: 0 }, publico: "cliente", ordem: 1 },
  { cycle_step: 1, titulo: "Entregável pronto", gatilho: { tipo: "evento", evento: "entregavel_aprovado" }, asset_type: "mensagem", timing: { quando: "imediato" }, publico: "cliente", ordem: 2 },
  { cycle_step: 2, titulo: "Lembrete de sessão", gatilho: { tipo: "evento", evento: "sessao_agendada" }, asset_type: "whatsapp", timing: { offset_dias: -1 }, publico: "equipe_cliente", ordem: 3 },
  { cycle_step: 3, titulo: "Reengajar se inativo", gatilho: { tipo: "estado", condicao: "inatividade", dias_limite: 10 }, asset_type: "email", timing: {}, publico: "cliente", ordem: 4 },
  { cycle_step: 4, titulo: "Recapitulação de resultados", gatilho: { tipo: "tempo", quando: "apos_inicio_fase", offset_dias: 7 }, asset_type: "relatorio", timing: { offset_dias: 7 }, publico: "cliente", ordem: 5 },
];

/** Mapeia passos de uma régua-template para uma nova régua de programa (cópia editável, sem asset_ref). */
export function instantiateSteps(steps: ReguaStep[], reguaId: string): Record<string, unknown>[] {
  return steps.map((s) => ({
    regua_id: reguaId, cycle_step: s.cycle_step, titulo: s.titulo, gatilho: s.gatilho,
    asset_type: s.asset_type, asset_ref: null, timing: s.timing ?? {}, publico: s.publico ?? "cliente", ordem: s.ordem ?? 0, ativo: s.ativo ?? true,
  }));
}
