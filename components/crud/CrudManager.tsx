"use client";
/**
 * Orquestrador do CRUD kit — plugue e pronto. Junta DataTable + ResourceForm (Drawer) +
 * ConfirmDelete + undo (rede de proteção) + lixeira (restaurar / excluir permanentemente).
 * "Controle total, sem medo": toda exclusão é reversível.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { getResource } from "@/lib/crud/registry";
import { duplicateCopy, type CrudOp } from "@/lib/crud/types";
import { crudRemove, crudRestore, crudHardDelete, type CrudResult } from "@/lib/crud/actions";
import { DataTable } from "./DataTable";
import { ResourceForm } from "./ResourceForm";
import { ConfirmDelete } from "./ConfirmDelete";

type Row = Record<string, unknown>;
type Overrides = {
  remove?: (id: string) => Promise<CrudResult>; restore?: (id: string) => Promise<CrudResult>;
  hardDelete?: (id: string) => Promise<CrudResult>; duplicate?: (id: string) => Promise<CrudResult>;
};

export function CrudManager({ resourceName, rows, trashRows, can, newHref, editHref, gotoOnDuplicate, overrides, extraRowActions, trashLabel }: {
  resourceName: string; rows: Row[]; trashRows: Row[]; can: Record<CrudOp, boolean>;
  newHref?: string;                          // "Novo" navega para cá (senão abre o Drawer)
  editHref?: (row: Row) => string;           // editar navega para cá (senão abre o Drawer)
  gotoOnDuplicate?: (newId: string) => string;   // após duplicar, ir para o editor do clone
  overrides?: Overrides;                     // ações específicas do agregado (cascata, deep clone)
  extraRowActions?: (row: Row) => React.ReactNode;
  trashLabel?: (row: Row) => string;
}) {
  const def = getResource(resourceName);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; row?: Row } | null>(null);
  const [confirming, setConfirming] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  const refresh = () => startTransition(() => router.refresh());
  const toast = (msg: string, ok = true) => { setFlash({ msg, ok }); setTimeout(() => setFlash(null), 3500); };

  // Duplicar: com override (deep clone no servidor → vai para o editor do clone) ou client-prefill.
  async function onDuplicate(row: Row) {
    if (overrides?.duplicate) {
      const res = await overrides.duplicate(String(row.id));
      if (res.ok) { toast(res.message); if (res.id && gotoOnDuplicate) startTransition(() => router.push(gotoOnDuplicate(res.id!))); else refresh(); }
      else toast(res.message, false);
      return;
    }
    setEditing({ mode: "create", row: duplicateCopy(def, row) });
  }

  async function confirmDelete() {
    if (!confirming) return;
    const id = String(confirming.id);
    const label = def.duplicate?.suffixField ? String(confirming[def.duplicate.suffixField] ?? def.singular) : def.singular;
    setBusy(true);
    const res = overrides?.remove ? await overrides.remove(id) : await crudRemove(resourceName, id);
    setBusy(false); setConfirming(null);
    if (res.ok) { setUndo({ id, label }); refresh(); setTimeout(() => setUndo((u) => (u?.id === id ? null : u)), 8000); }
    else toast(res.message, false);
  }
  async function doUndo() {
    if (!undo) return;
    const res = overrides?.restore ? await overrides.restore(undo.id) : await crudRestore(resourceName, undo.id);
    setUndo(null);
    if (res.ok) { toast(def.labels.restored); refresh(); } else toast(res.message, false);
  }
  async function doRestore(id: string) { const r = overrides?.restore ? await overrides.restore(id) : await crudRestore(resourceName, id); toast(r.ok ? def.labels.restored : r.message, r.ok); refresh(); }
  async function doHardDelete(id: string) { const r = overrides?.hardDelete ? await overrides.hardDelete(id) : await crudHardDelete(resourceName, id); toast(r.message, r.ok); refresh(); }

  return (
    <div>
      <DataTable resourceName={resourceName} rows={rows} can={can} extraRowActions={extraRowActions}
        onNew={newHref ? () => startTransition(() => router.push(newHref)) : () => setEditing({ mode: "create" })}
        onEdit={editHref ? (row) => startTransition(() => router.push(editHref(row))) : (row) => setEditing({ mode: "edit", row })}
        onDuplicate={onDuplicate}
        onDelete={(row) => setConfirming(row)} />

      {/* Lixeira — exclusão permanente é ação separada e explícita */}
      {trashRows.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowTrash((v) => !v)} className="ds-focus inline-flex items-center gap-1.5 font-montserrat text-[13px] font-medium text-[color:var(--fg-3)] hover:text-[color:var(--fg-1)]">
            <Icon name="close" size={13} /> Itens excluídos ({trashRows.length})
          </button>
          {showTrash && (
            <div className="mt-2 rounded-ds-card border border-hairline bg-[var(--bg-1)] p-2 shadow-ds-xs">
              {trashRows.map((row) => (
                <div key={String(row.id)} className="flex items-center justify-between gap-3 rounded-[8px] px-3 py-2 hover:bg-[var(--bg-2)]">
                  <span className="font-montserrat text-[14px] text-[color:var(--fg-2)] line-through">{trashLabel ? trashLabel(row) : def.duplicate?.suffixField ? String(row[def.duplicate.suffixField] ?? "") : String(row.id)}</span>
                  <div className="flex items-center gap-2">
                    {can.restore && <button onClick={() => doRestore(String(row.id))} className="ds-focus rounded-[8px] border border-hairline-strong px-2 py-1 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Restaurar</button>}
                    {can.delete && <button onClick={() => doHardDelete(String(row.id))} className="ds-focus rounded-[8px] px-2 py-1 font-montserrat text-[13px] text-[color:var(--danger)] hover:bg-[var(--danger-tint)]">Excluir permanentemente</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form (Drawer lateral) */}
      <Drawer open={!!editing} onClose={() => setEditing(null)}
        title={editing?.mode === "edit" ? `Editar ${def.singular}` : `Novo ${def.singular}`}>
        {editing && (
          <ResourceForm resourceName={resourceName} mode={editing.mode} id={editing.row?.id ? String(editing.row.id) : undefined}
            initial={editing.row}
            onCancel={() => setEditing(null)}
            onResult={(msg, ok) => { if (ok) { toast(msg); refresh(); } }}
            onSaved={() => setEditing(null)} />
        )}
      </Drawer>

      <ConfirmDelete open={!!confirming} title={def.labels.confirmDeleteTitle} body={def.labels.confirmDeleteBody}
        busy={busy} onCancel={() => setConfirming(null)} onConfirm={confirmDelete} />

      {/* Undo — rede de proteção */}
      {undo && (
        <div className="ds fixed bottom-4 left-1/2 z-[130] -translate-x-1/2">
          <div className="ds-animate-in flex items-center gap-3 rounded-ds-input border border-hairline bg-[var(--ink-violet)] px-4 py-3 shadow-ds-lg">
            <span className="font-montserrat text-sm text-white">{def.labels.removed}</span>
            <button onClick={doUndo} className="ds-focus font-montserrat text-sm font-semibold text-spark hover:underline">Desfazer</button>
          </div>
        </div>
      )}

      {/* Flash (criado/atualizado/duplicado) */}
      {flash && (
        <div className="ds fixed bottom-4 right-4 z-[120]">
          <div className="ds-animate-in flex items-center gap-2.5 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-4 py-3 shadow-ds-lg">
            <span className="h-2 w-2 rounded-full" style={{ background: flash.ok ? "var(--success)" : "var(--danger)" }} />
            <span className="font-montserrat text-sm text-[color:var(--fg-1)]">{flash.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
