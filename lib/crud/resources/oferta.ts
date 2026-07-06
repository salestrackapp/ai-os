/**
 * Recurso Oferta (catalog_items) — a fonte COMERCIAL das propostas (AI Diagnose, AI Sprint,
 * engajamento AI Operating System, Mentoria, workshops/treinamentos/palestras). Vendida e
 * entregue via AI OS — NÃO é "plano de plataforma". CRUD completo pelo kit R2.1.
 */
import { z } from "zod";
import { defineResource } from "../types";
import { BRAND_LABELS } from "@/lib/types";

export type OfertaRow = {
  id: string; name: string; kind: string | null; brand: string; unit: string | null;
  price: number | null; active: boolean; needs_review: boolean; deleted_at: string | null;
};

const BRANDS = Object.keys(BRAND_LABELS);

export const ofertaSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à oferta.").max(160),
  kind: z.string().trim().max(60).optional().or(z.literal("")),
  brand: z.enum(BRANDS as [string, ...string[]]),
  unit: z.string().trim().max(40).optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Preço não pode ser negativo."),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.coerce.boolean(),
  needs_review: z.coerce.boolean(),
});

export const ofertaResource = defineResource<OfertaRow>({
  name: "oferta",
  table: "catalog_items",
  singular: "oferta", plural: "ofertas",
  schema: ofertaSchema,
  orgScoped: false,
  softDelete: true,
  orderBy: { column: "name", ascending: true },
  searchKeys: ["name", "kind", "brand"],
  fields: [
    { name: "name", label: "Nome da oferta", type: "text", required: true, placeholder: "Ex.: AI Sprint" },
    { name: "brand", label: "Marca", type: "select", options: BRANDS.map((b) => ({ value: b, label: BRAND_LABELS[b] ?? b })) },
    { name: "kind", label: "Tipo", type: "text", placeholder: "Ex.: engajamento, sprint, mentoria, workshop" },
    { name: "unit", label: "Unidade", type: "text", placeholder: "Ex.: único, sprint, mês" },
    { name: "price", label: "Preço (R$)", type: "number", default: 0, min: 0, step: 1, help: "Marque 'precisa de revisão' se ainda não estiver fechado." },
    { name: "description", label: "Descrição", type: "textarea", placeholder: "O que a oferta entrega." },
    { name: "active", label: "Ativa (aparece nas propostas)", type: "boolean", default: true },
    { name: "needs_review", label: "Preço precisa de revisão", type: "boolean", default: false },
  ],
  columns: [
    { key: "name", header: "Oferta" },
    { key: "brand", header: "Marca", render: (r) => BRAND_LABELS[r.brand] ?? r.brand },
    { key: "unit", header: "Unidade" },
    { key: "price", header: "Preço", align: "right", mono: true, render: (r) => (r.price != null ? `R$ ${Number(r.price).toLocaleString("pt-BR")}` : "—") },
  ],
  duplicate: { suffixField: "name", suffix: " (cópia)" },
  permission: (actor) => actor.isSalestrackAdmin,
  revalidate: ["/admin/ofertas", "/admin/catalogo"],
  labels: {
    created: "Oferta criada.", updated: "Oferta salva.", removed: "Oferta excluída.",
    restored: "Oferta restaurada.", duplicated: "Oferta duplicada.",
    confirmDeleteTitle: "Excluir esta oferta?",
    confirmDeleteBody: "Ela sai do catálogo e das propostas, mas você pode desfazer logo em seguida.",
  },
});
