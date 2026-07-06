"use client";
import { useState } from "react";
import { portalDownload } from "@/app/portal/entregaveis/actions";

export function PortalDownloadButton({ id, label = "Baixar" }: { id: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn-gold text-xs" disabled={busy}
      onClick={async () => { setBusy(true); try { const u = await portalDownload(id); window.open(u, "_blank"); } catch (e) { alert((e as Error).message); } finally { setBusy(false); } }}
    >{busy ? "Gerando…" : label}</button>
  );
}
