"use client";
/** Aplica o kit CRUD ao Programa com as regras próprias do agregado (cascata, deep clone, editor, ver portal). */
import Link from "next/link";
import { CrudManager } from "@/components/crud/CrudManager";
import { Icon } from "@/components/ui/icons";
import type { CrudOp } from "@/lib/crud/types";
import { removeProgramaCascade, restoreProgramaCascade, hardDeletePrograma, duplicateProgramaDeep } from "@/lib/crud/programa-actions";
import { viewPortalAs } from "@/app/admin/programas/actions";

type Row = Record<string, unknown>;

export function ProgramaManager({ rows, trashRows, can }: { rows: Row[]; trashRows: Row[]; can: Record<CrudOp, boolean> }) {
  return (
    <CrudManager
      resourceName="programa" rows={rows} trashRows={trashRows} can={can}
      newHref="/admin/programas/novo"
      editHref={(row) => `/admin/programas/${row.id}/editar`}
      gotoOnDuplicate={(id) => `/admin/programas/${id}/editar`}
      overrides={{ remove: removeProgramaCascade, restore: restoreProgramaCascade, hardDelete: hardDeletePrograma, duplicate: duplicateProgramaDeep }}
      trashLabel={(row) => String(row.name ?? "")}
      extraRowActions={(row) => (
        <>
          {!!row.org_id && <Link href={`/admin/clientes/${row.org_id}`} title="Ficha 360 do cliente" className="ds-focus rounded-[8px] p-1.5 text-[color:var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[color:var(--brand)]"><Icon name="team" size={15} /></Link>}
          <Link href={`/admin/programas/${row.id}`} title="Abrir (operação: sessões, biblioteca, kickoff)" className="ds-focus rounded-[8px] p-1.5 text-[color:var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[color:var(--brand)]"><Icon name="rocket" size={15} /></Link>
          {!!row.org_id && (
            <form action={viewPortalAs.bind(null, String(row.org_id))} className="inline">
              <button title="Ver portal do cliente" className="ds-focus rounded-[8px] p-1.5 text-[color:var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[color:var(--brand)]"><Icon name="eye" size={15} /></button>
            </form>
          )}
        </>
      )}
    />
  );
}
