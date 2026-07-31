import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { getChannel } from "./channels";
import { resolveAsset, type Recipient } from "./resolve-vars";
import { buildEmailHtml } from "@/lib/studio/render/email";
import { linkDescadastro, podeEnviarMarketing } from "@/lib/lgpd/consentimento";
import type { DeliverableContent } from "@/lib/deliverables/types";

export type SendResult = { status: "enviado" | "falhou" | "manual" | "bloqueado"; motivo?: string; providerRef?: string | null; content?: string; deliveryId?: string };

/**
 * Este endereço pode receber por este canal?
 *
 * ── O que estava errado ───────────────────────────────────────────────────────────────────────
 * A versão anterior, ao receber `optIn: true` de quem chamou, GRAVAVA em `comms_consent` uma linha
 * dizendo "confirmado no envio (admin)". Só que quem chamava marcava `optIn: true` para todo e-mail
 * automaticamente — ninguém tinha confirmado nada. O resultado era uma tabela de consentimento
 * cheia de consentimentos inventados, e num pedido de titular ou numa auditoria essa tabela seria
 * a prova. Registro falso de consentimento é pior do que ausência de registro: um diz "não sei", o
 * outro afirma uma coisa que não aconteceu.
 *
 * ── A regra agora ─────────────────────────────────────────────────────────────────────────────
 * E-MAIL de programa não depende de opt-in e sim de execução de contrato: a pessoa é do cliente e a
 * mensagem é sobre o serviço contratado. Passa, e não grava consentimento nenhum — porque não há
 * consentimento a registrar. (Marketing é outra coisa, barrada logo abaixo por `podeEnviarMarketing`.)
 *
 * WHATSAPP depende de aceite explícito, porque o canal é pessoal. A fonte é `contacts.opt_in_whatsapp`,
 * marcado por quem falou com a pessoa, ou uma linha prévia em `comms_consent`. Nunca o próprio envio.
 */
async function consentOk(orgId: string | null, canal: string, endereco: string, optIn?: boolean): Promise<boolean> {
  if (canal === "email") return true;
  if (optIn) return true;   // veio de contacts.opt_in_whatsapp — aceite dado antes, fora daqui
  const sb = createServiceClient();
  const { data } = await sb.from("comms_consent").select("opt_in").eq("org_id", orgId ?? "").eq("canal", canal).eq("endereco", endereco).maybeSingle();
  return !!data?.opt_in;
}

/**
 * PRIMITIVO de envio unitário (R4.2) — reusado em escala pelo R4.3.
 * gate do ativo (aprovado+elegível) → resolve variáveis (bloqueia faltante, PII só em memória) →
 * consentimento → dispatch pelo canal → registro de entrega. PII NUNCA é gravada no ativo.
 */
export async function sendOne(opts: { deliverableId: string; canal: "whatsapp" | "email"; recipient: Recipient; optIn?: boolean; test?: boolean; actorId?: string | null }): Promise<SendResult> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("id, org_id, line, status, comm_eligible, comm_channel, content, version").eq("id", opts.deliverableId).single();
  if (!dv) return { status: "falhou", motivo: "Ativo não encontrado." };

  // 1) Gate do ativo (defesa em profundidade) — só aprovado/publicado/entregue + elegível
  if (!["aprovado", "publicado", "entregue"].includes(dv.status)) return { status: "falhou", motivo: `Ativo não aprovado (${dv.status}).` };
  if (!dv.comm_eligible) return { status: "falhou", motivo: "Ativo não elegível para orquestração." };

  const content = (dv.content ?? {}) as DeliverableContent;
  const endereco = opts.canal === "email" ? (opts.recipient.email ?? "") : (opts.recipient.phone ?? "");
  if (!endereco) return { status: "falhou", motivo: `Destinatário sem ${opts.canal === "email" ? "e-mail" : "telefone"}.` };

  // 2) Resolver variáveis (PII só aqui) + validar obrigatórias
  let subject: string | undefined, html: string | undefined, text: string | undefined, missing: string[] = [];
  if (opts.canal === "email") {
    const e = content.email;
    if (!e) return { status: "falhou", motivo: "Ativo não é um e-mail." };
    const r = resolveAsset([e.assunto, e.preheader ?? "", ...e.corpo, e.cta?.label ?? ""], opts.recipient);
    missing = r.missing;
    subject = r.resolved[0];
    // Todo e-mail sai com via de saída própria. O link é gerado por destinatário e é estável —
    // o mesmo endereço recebe sempre o mesmo token, então um e-mail antigo continua funcionando.
    const unsubscribeUrl = await linkDescadastro(endereco);
    if (r.ok) html = buildEmailHtml({ assunto: r.resolved[0], preheader: r.resolved[1], corpo: r.resolved.slice(2, 2 + e.corpo.length), cta: e.cta ? { label: r.resolved[2 + e.corpo.length], url: e.cta.url } : undefined, attribution: dv.line === "email_mkt" ? "salestrack" : "salestrack", unsubscribeUrl });
  } else {
    const m = content.message;
    if (!m) return { status: "falhou", motivo: "Ativo não é uma mensagem." };
    const r = resolveAsset([m.texto], opts.recipient);
    missing = r.missing; text = r.resolved[0];
  }
  if (missing.length) {
    await record(dv, opts, endereco, "bloqueado", null, `Variáveis faltantes: ${missing.join(", ")}`);
    return { status: "bloqueado", motivo: `Faltam variáveis do destinatário: ${missing.join(", ")}. Nada é enviado com placeholder.` };
  }

  // 3) Consentimento — duas perguntas distintas, e as duas precisam passar.
  //    (a) o gate de canal: este endereço aceita receber por aqui?
  if (!(await consentOk(dv.org_id, opts.canal, endereco, opts.optIn))) {
    await record(dv, opts, endereco, "bloqueado", null, "Sem consentimento (opt-in).");
    return { status: "bloqueado", motivo: "Destinatário sem consentimento (opt-in) para este canal." };
  }
  //    (b) a finalidade: peça de MARKETING exige consentimento para marketing, que é coisa
  //        diferente de ter aceitado receber um documento do próprio projeto. Um teste do admin
  //        não passa por aqui — é o admin mandando para si mesmo, não campanha.
  if (dv.line === "email_mkt" && !opts.test && opts.canal === "email" && !(await podeEnviarMarketing(endereco))) {
    await record(dv, opts, endereco, "bloqueado", null, "Sem consentimento de marketing (LGPD).");
    return { status: "bloqueado", motivo: "Este destinatário não consentiu receber marketing. Nada é enviado." };
  }

  // 4) Dispatch
  const ch = getChannel(opts.canal)!;
  const res = await ch.dispatch({ orgId: dv.org_id, recipient: { email: opts.recipient.email, phone: opts.recipient.phone }, subject, html, text, ref: { table: "studio_deliverables", id: dv.id } });

  // 5) Registro de entrega + auditoria (sem gravar o conteúdo resolvido/PII)
  const deliveryId = await record(dv, opts, endereco, res.status, res.providerRef, res.erro);
  await auditService("comms.send", "comms_delivery", deliveryId, { canal: opts.canal, status: res.status, test: !!opts.test }, dv.org_id);
  return { status: res.status, providerRef: res.providerRef, content: res.content, deliveryId };
}

async function record(dv: { id: string; org_id: string | null; version: number }, opts: { canal: string; test?: boolean }, endereco: string, status: string, providerRef?: string | null, erro?: string): Promise<string | undefined> {
  const sb = createServiceClient();
  const { data } = await sb.from("comms_delivery").insert({
    org_id: dv.org_id, deliverable_id: dv.id, deliverable_version: dv.version, canal: opts.canal,
    destinatario: endereco, status, provider_ref: providerRef ?? null, erro: erro ?? null, test: !!opts.test,
    sent_at: status === "enviado" ? new Date().toISOString() : null,
  }).select("id").single();
  return data?.id;
}
