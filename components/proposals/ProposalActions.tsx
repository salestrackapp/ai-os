"use client";
import { useState, useTransition } from "react";
import { sendProposal, newVersion, resendNotification } from "@/app/admin/propostas/actions";

export function ProposalActions({ id, status, link }: { id: string; status: string; link: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  function copy() { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }

  return (
    <div className="space-y-2">
      {status === "rascunho" && <button className="btn-gold w-full justify-center" disabled={pending} onClick={() => start(() => sendProposal(id).then(() => {}))}>Enviar proposta</button>}
      <button className="btn-ghost w-full justify-center" onClick={copy}>{copied ? "✓ Link copiado" : "Copiar link público"}</button>
      {["enviada", "em_leitura", "ajuste_solicitado"].includes(status) && (
        <button className="btn-ghost w-full justify-center" disabled={pending} onClick={() => start(() => resendNotification(id).then(() => {}))}>Reenviar notificação</button>
      )}
      {status !== "rascunho" && (
        <button className="btn-ghost w-full justify-center" disabled={pending} onClick={() => start(() => newVersion(id).then(() => {}))}>Gerar nova versão</button>
      )}
    </div>
  );
}
