import { z } from "zod";
import { defineLine, type LineContext } from "../define-line";
import { studioPrompt } from "./schemas";
import { extractVars, channelIssues } from "../copy/channel";
import type { DeliverableContent } from "@/lib/deliverables/types";

/** Família D · Mensagens & Copy (R3.6) — copy por canal (regras próprias) + variantes. Estúdio cria; R4 orquestra. */

const variantes = z.array(z.string().min(1).max(3000)).max(3).optional().catch(undefined);
const variaveisIn = z.array(z.string().max(60)).max(12).optional().catch(undefined);

function msgContent(canal: "post" | "mensagem" | "whatsapp", texto: string, extra: Partial<DeliverableContent["message"]>, ctx: LineContext, label: string): DeliverableContent {
  const variaveis = [...new Set([...(extra?.variaveis ?? []), ...extractVars(texto), ...((extra?.variantes ?? []).flatMap(extractVars))])];
  return {
    cover: { eyebrow: label, title: `${label} · ${ctx.orgName}`, subtitle: ctx.orgName },
    message: { canal, texto, ...extra, variaveis },
  };
}

// ── Post: gancho + corpo + CTA + hashtags + sugestão visual (par com Arte R3.7) ──
const postSchema = z.object({
  plataforma: z.string().max(40).default("LinkedIn"),
  gancho: z.string().min(3).max(400),
  corpo: z.string().min(10).max(2600),
  cta: z.string().max(200).optional().catch(undefined),
  hashtags: z.array(z.string().min(1).max(40)).max(12).optional().catch(undefined),
  sugestao_visual: z.string().max(400).optional().catch(undefined),
  variantes,
});
const post = defineLine({
  key: "post", label: "Post", description: "Post de rede social: gancho + corpo + CTA + hashtags + arte sugerida.",
  family: "mensagens", brandDefault: "salestrack", kind: "one_pager", renderTarget: "html", contentSchema: postSchema, commChannel: "post", deepenedIn: "R3.6",
  buildPrompt: (ctx) => studioPrompt(
    "Escreva um POST de rede social (LinkedIn por padrão): gancho forte, corpo escaneável, CTA, 3–6 hashtags e uma SUGESTÃO VISUAL (para a Arte). Ofereça 1–2 variantes do texto completo em 'variantes'. Não inclua dados pessoais reais — use {{variaveis}} se precisar personalizar.",
    '{ "plataforma": string, "gancho": string, "corpo": string, "cta"?: string, "hashtags"?: string[], "sugestao_visual"?: string, "variantes"?: string[] }', ctx),
  toContent: (d, ctx) => msgContent("post", `${d.gancho}\n\n${d.corpo}`, { plataforma: d.plataforma, cta: d.cta, hashtags: d.hashtags, sugestao_visual: d.sugestao_visual, variantes: d.variantes }, ctx, `Post · ${d.plataforma}`),
});

// ── Mensagem curta genérica ──
const mensagemSchema = z.object({ texto: z.string().min(3).max(600), variaveis: variaveisIn, variantes });
const mensagem = defineLine({
  key: "mensagem", label: "Mensagem", description: "Mensagem curta e direta (avisos, follow-ups).",
  family: "mensagens", brandDefault: "salestrack", kind: "one_pager", renderTarget: "html", contentSchema: mensagemSchema, commChannel: "generic", deepenedIn: "R3.6",
  buildPrompt: (ctx) => studioPrompt("Escreva uma MENSAGEM curta, clara e cordial (≤ 600 caracteres). Use {{nome}}/{{empresa}} se personalizar (nunca dados reais). Ofereça 1–2 variantes.",
    '{ "texto": string, "variaveis"?: string[], "variantes"?: string[] }', ctx),
  toContent: (d, ctx) => msgContent("mensagem", d.texto, { variaveis: d.variaveis, variantes: d.variantes }, ctx, "Mensagem"),
});

// ── WhatsApp: texto puro, limite, template Z-API + variáveis ──
const whatsappSchema = z.object({ texto: z.string().min(3).max(1000), variaveis: variaveisIn, variantes })
  .refine((d) => channelIssues("whatsapp", d.texto).length === 0, { message: "WhatsApp: texto puro e dentro do limite (1000)." });
const whatsapp = defineLine({
  key: "whatsapp", label: "Mensagem WhatsApp", description: "WhatsApp: texto puro, tom próximo, compatível com template Z-API + variáveis.",
  family: "mensagens", brandDefault: "salestrack", kind: "one_pager", renderTarget: "html", contentSchema: whatsappSchema, commChannel: "whatsapp", deepenedIn: "R3.6",
  buildPrompt: (ctx) => studioPrompt("Escreva uma MENSAGEM DE WHATSAPP: TEXTO PURO (sem HTML/markdown), curta, tom próximo, 1 CTA claro, emoji com parcimônia. Use {{nome}} para personalizar (nunca dados reais). Compatível com template Z-API. Ofereça 1–2 variantes.",
    '{ "texto": string, "variaveis"?: string[], "variantes"?: string[] }', ctx),
  toContent: (d, ctx) => msgContent("whatsapp", d.texto, { variaveis: d.variaveis, variantes: d.variantes }, ctx, "WhatsApp"),
});

// ── E-mail marketing: assunto + preheader + corpo (blocos) + CTA → HTML MailerLite-ready ──
const emailSchema = z.object({
  assunto: z.string().min(3).max(120),
  preheader: z.string().max(160).optional().catch(undefined),
  corpo: z.array(z.string().min(1).max(2000)).min(1).max(12),
  cta: z.object({ label: z.string().min(1).max(60), url: z.string().max(300).optional().catch(undefined) }).optional().catch(undefined),
  variaveis: variaveisIn,
});
const email = defineLine({
  key: "email_mkt", label: "E-mail marketing", description: "E-mail HTML MailerLite-ready: assunto, preheader, corpo, CTA, rodapé/descadastro.",
  family: "mensagens", brandDefault: "salestrack", kind: "one_pager", renderTarget: "html", contentSchema: emailSchema, commChannel: "email", deepenedIn: "R3.6",
  buildPrompt: (ctx) => studioPrompt("Escreva um E-MAIL DE MARKETING: assunto curto e forte, preheader, corpo em 2–5 blocos (parágrafos) escaneáveis e 1 CTA (label + url opcional). Use {{nome}} se personalizar (nunca dados reais).",
    '{ "assunto": string, "preheader"?: string, "corpo": string[], "cta"?: { "label": string, "url"?: string }, "variaveis"?: string[] }', ctx),
  toContent: (d, ctx) => {
    const variaveis = [...new Set([...(d.variaveis ?? []), ...extractVars([d.assunto, d.preheader ?? "", ...d.corpo].join("\n"))])];
    return {
      cover: { eyebrow: "E-mail marketing", title: d.assunto, subtitle: ctx.orgName },
      email: { assunto: d.assunto, preheader: d.preheader, corpo: d.corpo, cta: d.cta, variaveis },
    };
  },
});

export const mensagensLines = [post, mensagem, whatsapp, email];
