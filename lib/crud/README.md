# CRUD kit — controle total em 1 passo (R2.1)

Dar **criar / editar / duplicar / excluir (com desfazer)** a uma tela = **declarar um recurso** + **plugar 2 componentes**. Servidor valida, checa permissão, audita e respeita RLS.

## Passo 1 — declare o recurso

`lib/crud/resources/<nome>.ts`:

```ts
import { z } from "zod";
import { defineResource } from "../types";

export const meuRecurso = defineResource({
  name: "programas",            // id usado pelo client
  table: "projects",            // tabela no banco
  singular: "programa", plural: "programas",
  schema: z.object({ name: z.string().min(2), phase: z.string() }),  // validação client + server
  orgScoped: true,              // grava/filtra por org_id?
  softDelete: true,             // usa deleted_at? (precisa da coluna — ver migration 018)
  orderBy: { column: "created_at", ascending: false },
  searchKeys: ["name"],
  fields: [                     // geram o formulário
    { name: "name", label: "Nome", type: "text", required: true },
    { name: "phase", label: "Fase", type: "text" },
  ],
  columns: [{ key: "name", header: "Programa" }, { key: "phase", header: "Fase" }],
  duplicate: { suffixField: "name", suffix: " (cópia)" },
  permission: (actor) => actor.isSalestrackAdmin,   // regra no servidor
  revalidate: ["/admin/programas"],
  labels: { created: "Programa criado.", updated: "Salvo.", removed: "Programa excluído.",
            restored: "Restaurado.", duplicated: "Duplicado.",
            confirmDeleteTitle: "Excluir este programa?", confirmDeleteBody: "Você pode desfazer logo em seguida." },
});
```

Registre em `lib/crud/registry.ts` (adicione à lista `ALL`).

Para `softDelete`, a tabela precisa da coluna: `alter table <t> add column if not exists deleted_at timestamptz;` + as listagens filtram `deleted_at is null` (o kit já faz via `listResource`).

## Passo 2 — plugue na página (server component)

```tsx
import { CrudManager } from "@/components/crud/CrudManager";
import { listResource, resourcePermissions } from "@/lib/crud/query";

export default async function Page() {
  const [rows, trash, can] = await Promise.all([
    listResource("programas"),
    listResource("programas", { trash: true }),
    resourcePermissions("programas"),
  ]);
  return <CrudManager resourceName="programas" rows={rows} trashRows={trash} can={can} />;
}
```

Pronto: busca, ordenação, paginação, criar/editar (Drawer + validação), duplicar (form pré-preenchido), excluir **soft + Desfazer**, lixeira com **restaurar / excluir permanentemente** — tudo auditado, tudo por org (RLS), tudo no design v5.

## O que o servidor garante (não confie só na UI)
`lib/crud/actions.ts`: cada ação re-valida com o `schema`, re-checa `permission(actor, op)` e grava em `lib/audit.ts`. A UI apenas **esconde** o que o servidor **recusa**.
