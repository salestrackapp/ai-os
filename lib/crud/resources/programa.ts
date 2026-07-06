/**
 * Recurso Programa (projects) — o coração do admin. CRUD completo via kit R2.1.
 * A estrutura (fases/marcos = timeline jsonb + deliverables) e as 3 origens de criação
 * têm fluxos próprios (ver lib/crud/programa-actions.ts e o editor); aqui ficam os metadados.
 */
import { z } from "zod";
import { defineResource } from "../types";
import { PROJECT_STATUS_LABELS } from "@/lib/types";

export type ProgramaRow = {
  id: string; org_id: string; name: string; phase: string | null; status: string;
  progress_pct: number | null; cycle_step: number | null; deleted_at: string | null; org_name?: string;
};

const STATUS = Object.keys(PROJECT_STATUS_LABELS);

export const programaSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome ao programa.").max(160),
  phase: z.string().trim().max(120).optional().or(z.literal("")),
  status: z.enum(STATUS as [string, ...string[]]),
  progress_pct: z.coerce.number().int().min(0).max(100),
  cycle_step: z.coerce.number().int().min(0).max(4),
});

export const programaResource = defineResource<ProgramaRow>({
  name: "programa",
  table: "projects",
  singular: "programa", plural: "programas",
  schema: programaSchema,
  orgScoped: false,       // pertence à org do CLIENTE (não à do admin); org definida na criação
  softDelete: true,
  orderBy: { column: "created_at", ascending: false },
  searchKeys: ["name", "org_name", "status"],
  fields: [
    { name: "name", label: "Nome do programa", type: "text", required: true, placeholder: "Ex.: Programa de IA — Clínica" },
    { name: "phase", label: "Fase atual (texto livre)", type: "text", placeholder: "Ex.: Consolidação digital" },
    { name: "status", label: "Situação", type: "select", options: STATUS.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] })) },
    { name: "cycle_step", label: "Passo do ciclo (0–4)", type: "number", default: 0, min: 0, max: 4, help: "0 Diagnosticar · 1 Estruturar · 2 Implementar · 3 Capacitar · 4 Evoluir. Aparece na Jornada do cliente." },
    { name: "progress_pct", label: "Progresso (%)", type: "number", default: 0, min: 0, max: 100 },
  ],
  columns: [
    { key: "name", header: "Programa" },
    { key: "org_name", header: "Cliente" },
    { key: "status", header: "Situação", render: (r) => PROJECT_STATUS_LABELS[r.status] ?? r.status },
    { key: "progress_pct", header: "Progresso", align: "right", mono: true, render: (r) => `${r.progress_pct ?? 0}%` },
  ],
  duplicate: { suffixField: "name", suffix: " (cópia)", clear: ["activated_at", "activated_by", "contract_id"] },
  permission: (actor) => actor.isSalestrackAdmin,
  revalidate: ["/admin/programas"],
  labels: {
    created: "Programa criado.", updated: "Programa salvo.", removed: "Programa excluído.",
    restored: "Programa restaurado.", duplicated: "Programa duplicado — ajuste o clone.",
    confirmDeleteTitle: "Excluir este programa?",
    confirmDeleteBody: "O programa e seus entregáveis saem das listas, mas você pode desfazer logo em seguida — e restaura tudo junto.",
  },
});
