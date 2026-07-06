/**
 * Recurso de referência do CRUD kit: sinais de prospecção (signal_definitions).
 * Simples, admin-only, baixo risco — prova viva do padrão para R2.2/R2.3.
 */
import { z } from "zod";
import { defineResource } from "../types";

export type SignalRow = {
  id: string; label: string; weight: number; active: boolean; sort: number; deleted_at: string | null;
};

export const signalSchema = z.object({
  label: z.string().trim().min(2, "Descreva o sinal com pelo menos 2 caracteres.").max(120),
  weight: z.coerce.number().int().min(0, "Peso mínimo 0.").max(50, "Peso máximo 50."),
  active: z.coerce.boolean(),
  sort: z.coerce.number().int().min(0).max(999),
});

export const signalsResource = defineResource<SignalRow>({
  name: "signals",
  table: "signal_definitions",
  singular: "sinal", plural: "sinais de prospecção",
  schema: signalSchema,
  orgScoped: false,
  softDelete: true,
  orderBy: { column: "sort", ascending: true },
  searchKeys: ["label"],
  fields: [
    { name: "label", label: "Sinal", type: "text", required: true, placeholder: "Ex.: Contratou head de vendas", help: "O gatilho que indica um bom momento para abordar." },
    { name: "weight", label: "Peso", type: "number", default: 5, min: 0, max: 50, step: 1, help: "Quanto este sinal soma no score do prospect." },
    { name: "sort", label: "Ordem", type: "number", default: 0, min: 0, max: 999 },
    { name: "active", label: "Ativo", type: "boolean", default: true },
  ],
  columns: [
    { key: "label", header: "Sinal" },
    { key: "weight", header: "Peso", align: "right", mono: true },
    { key: "sort", header: "Ordem", align: "right", mono: true },
    { key: "active", header: "Ativo" },
  ],
  duplicate: { suffixField: "label", suffix: " (cópia)" },
  permission: (actor) => actor.isSalestrackAdmin,
  revalidate: ["/admin/sinais"],
  labels: {
    created: "Sinal criado.", updated: "Sinal atualizado.", removed: "Sinal excluído.",
    restored: "Sinal restaurado.", duplicated: "Sinal duplicado.",
    confirmDeleteTitle: "Excluir este sinal?",
    confirmDeleteBody: "Ele sai da lista, mas você pode desfazer logo em seguida — nada é perdido de imediato.",
  },
});
