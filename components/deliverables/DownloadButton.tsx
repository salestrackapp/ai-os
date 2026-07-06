"use client";
import { useState } from "react";
import { downloadAction } from "@/app/admin/entregaveis/actions";

/** Baixa o artefato via URL assinada (gerada sob demanda; o bucket é privado). */
export function DownloadButton({ id, label = "Baixar", className = "btn-gold text-xs" }: { id: string; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { const url = await downloadAction(id); window.open(url, "_blank"); }
        catch (e) { alert((e as Error).message); }
        finally { setBusy(false); }
      }}
    >{busy ? "Gerando…" : label}</button>
  );
}
