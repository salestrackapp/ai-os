"use client";
/** Confirmação de exclusão (soft) — clara, tom copiloto. A rede de proteção (undo) fica no CrudManager. */
import { Dialog } from "@/components/ds";

export function ConfirmDelete({ open, title, body, busy, onConfirm, onCancel }: {
  open: boolean; title: string; body: string; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}
      footer={<>
        <button onClick={onCancel} className="ds-focus rounded-ds-input px-4 py-2 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Cancelar</button>
        <button onClick={onConfirm} disabled={busy} className="ds-focus inline-flex h-10 items-center rounded-ds-input bg-[color:var(--danger)] px-4 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45">{busy ? "Excluindo…" : "Excluir"}</button>
      </>}>
      {body}
    </Dialog>
  );
}
