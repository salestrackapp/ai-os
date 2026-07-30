/**
 * Biblioteca de referências da Academy — prompts prontos, ferramentas, glossário e checklist.
 *
 * Declarado como recurso do CRUD kit para o André editar os 87 registros sem depender de deploy.
 * Todos os campos são texto com rótulo em português: nenhum passo da edição pede que alguém
 * entenda formato técnico.
 */
import { z } from "zod";
import { defineResource } from "../types";

export type ReferenciaRow = {
  id: string; tipo: string; chave: string; ordem: number; nome: string;
  categoria: string | null; icone: string | null; cor: string | null; conteudo: string | null;
  impacto: string | null; ferramentas: string | null; sistema: string | null;
  parametros: string | null; retorno: string | null; termo_en: string | null;
  exemplo: string | null; risco: string | null; publicado: boolean; deleted_at: string | null;
};

const opcional = z.string().trim().max(8000).optional().or(z.literal(""));

export const referenciaSchema = z.object({
  tipo: z.enum(["prompt", "ferramenta", "termo", "checklist"]),
  chave: z.string().trim().min(1, "Dê um identificador curto, ex.: v25.").max(60),
  nome: z.string().trim().min(2, "O nome precisa de pelo menos 2 caracteres.").max(300),
  categoria: opcional,
  conteudo: opcional,
  impacto: opcional,
  ferramentas: opcional,
  sistema: opcional,
  parametros: opcional,
  retorno: opcional,
  termo_en: opcional,
  exemplo: opcional,
  risco: z.enum(["alto", "medio", "baixo"]).optional().or(z.literal("")),
  icone: z.string().trim().max(8).optional().or(z.literal("")),
  cor: z.string().trim().max(16).optional().or(z.literal("")),
  ordem: z.coerce.number().int().min(0).max(999),
  publicado: z.coerce.boolean(),
});

export const academyReferenciasResource = defineResource<ReferenciaRow>({
  name: "academy_referencias",
  table: "academy_referencias",
  singular: "referência", plural: "referências da Academy",
  schema: referenciaSchema,
  orgScoped: false,
  softDelete: true,
  orderBy: { column: "ordem", ascending: true },
  searchKeys: ["nome", "categoria", "conteudo"],
  fields: [
    { name: "tipo", label: "Tipo", type: "select", required: true, help: "Determina onde a referência aparece para o aluno.",
      options: [
        { value: "prompt", label: "Prompt pronto" },
        { value: "ferramenta", label: "Ferramenta" },
        { value: "termo", label: "Termo do glossário" },
        { value: "checklist", label: "Item do checklist" },
      ] },
    { name: "nome", label: "Nome", type: "text", required: true, placeholder: "Ex.: Qualificação de Leads (BANT)" },
    { name: "categoria", label: "Categoria", type: "text", placeholder: "Ex.: Vendas, CRM, Agentes", help: "Agrupa a referência na busca do aluno." },
    { name: "conteudo", label: "Conteúdo", type: "textarea", help: "O prompt completo, a descrição da ferramenta, a definição do termo ou o detalhe do item." },
    { name: "impacto", label: "Impacto (só para prompt)", type: "text", placeholder: "Ex.: Triagem 10× mais rápida" },
    { name: "ferramentas", label: "Ferramentas que usa (só para prompt)", type: "textarea", help: "Uma por linha." },
    { name: "sistema", label: "Sistema (só para ferramenta)", type: "text", placeholder: "Ex.: HubSpot, ERP" },
    { name: "parametros", label: "O que recebe (só para ferramenta)", type: "textarea" },
    { name: "retorno", label: "O que devolve (só para ferramenta)", type: "textarea" },
    { name: "termo_en", label: "Termo em inglês (só para glossário)", type: "text" },
    { name: "exemplo", label: "Exemplo", type: "textarea" },
    { name: "risco", label: "Risco (só para checklist)", type: "select",
      options: [{ value: "", label: "—" }, { value: "alto", label: "Alto" }, { value: "medio", label: "Médio" }, { value: "baixo", label: "Baixo" }] },
    { name: "icone", label: "Ícone", type: "text", placeholder: "Um emoji", help: "Aparece ao lado do nome." },
    { name: "cor", label: "Cor", type: "text", placeholder: "#EC4899" },
    { name: "chave", label: "Identificador", type: "text", required: true, help: "Curto e único dentro do tipo. Serve para reimportar sem duplicar." },
    { name: "ordem", label: "Ordem", type: "number", default: 0, min: 0, max: 999 },
    { name: "publicado", label: "Publicado", type: "boolean", default: true, help: "Desmarcado, só a equipe Salestrack enxerga." },
  ],
  columns: [
    { key: "tipo", header: "Tipo" },
    { key: "nome", header: "Nome" },
    { key: "categoria", header: "Categoria" },
    { key: "ordem", header: "Ordem", align: "right", mono: true },
    { key: "publicado", header: "Publicado" },
  ],
  duplicate: { suffixField: "nome", suffix: " (cópia)", clear: ["chave"] },
  permission: (actor) => actor.isSalestrackAdmin,
  revalidate: ["/admin/academy/referencias", "/academy/referencias"],
  labels: {
    created: "Referência criada.", updated: "Referência atualizada.", removed: "Referência excluída.",
    restored: "Referência restaurada.", duplicated: "Referência duplicada.",
    confirmDeleteTitle: "Excluir esta referência?",
    confirmDeleteBody: "Ela sai da biblioteca do aluno, mas você pode desfazer logo em seguida.",
  },
});
