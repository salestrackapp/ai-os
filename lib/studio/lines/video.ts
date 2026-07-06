import { z } from "zod";
import { defineLine } from "../define-line";
import { studioPrompt } from "./schemas";
import type { DeliverableContent } from "@/lib/deliverables/types";

/** Família F · Vídeo (R3.8) — roteiro + storyboard com IA; render nas ferramentas da Salestrack (graceful). */

const cenaSchema = z.object({
  visual: z.string().min(3).max(1000),
  duracao: z.string().max(40).optional().catch(undefined),
  narracao: z.string().max(1000).optional().catch(undefined),
  texto_tela: z.string().max(300).optional().catch(undefined),
  arte: z.object({ headline: z.string().max(240).optional().catch(undefined), copy: z.string().max(400).optional().catch(undefined), dado: z.object({ value: z.string().max(40), label: z.string().max(120), caption: z.string().max(200).optional().catch(undefined) }).optional().catch(undefined) }).optional().catch(undefined),
});
const videoSchema = z.object({
  tipo: z.enum(["explainer", "apresentador", "short", "modulo"]).default("explainer"),
  roteiro: z.object({ narracao: z.array(z.string().min(1).max(2000)).min(1).max(30), textos_tela: z.array(z.string().min(1).max(300)).max(30).optional().catch(undefined) }),
  storyboard: z.array(cenaSchema).min(2).max(24),
  voiceover: z.string().max(120).optional().catch(undefined),
});

export const videoLine = defineLine({
  key: "video_roteiro", label: "Vídeo (roteiro + storyboard)", description: "Roteiro (narração + textos em tela) + storyboard por cena. Render nas ferramentas da Salestrack.",
  family: "video", brandDefault: "salestrack", kind: "one_pager", renderTarget: "pdf", contentSchema: videoSchema, commChannel: "post", deepenedIn: "R3.8",
  buildPrompt: (ctx) => studioPrompt(
    "Produza um VÍDEO curto: (1) ROTEIRO com narração (blocos) e textos em tela; (2) STORYBOARD de 3–8 cenas, cada uma com visual (descrição), duração, narração e texto na tela. A 1ª cena é a ABERTURA e a última o ENCERRAMENTO. Use dado real numa cena se houver.",
    '{ "tipo": "explainer|apresentador|short|modulo", "roteiro": { "narracao": string[], "textos_tela"?: string[] }, "storyboard": [{ "visual": string, "duracao"?: string, "narracao"?: string, "texto_tela"?: string, "arte"?: { "headline"?: string, "dado"?: {"value":string,"label":string} } }], "voiceover"?: string }',
    ctx),
  toContent: (d, ctx): DeliverableContent => ({
    cover: { eyebrow: `Vídeo · ${d.tipo}`, title: `Vídeo · ${ctx.orgName}`, subtitle: ctx.orgName, meta: ["Salestrack AI", "Storyboard", `${d.storyboard.length} cenas`] },
    video: { tipo: d.tipo, roteiro: { narracao: d.roteiro.narracao, textos_tela: d.roteiro.textos_tela ?? [] }, storyboard: d.storyboard, voiceover: d.voiceover },
  }),
});

export const videoLines = [videoLine];
