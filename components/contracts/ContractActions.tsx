"use client";
import { useState, useTransition } from "react";
import { sendForSignature, registerManualSignature, reexecuteKickoff } from "@/app/admin/contratos/actions";

export function ContractActions({ id, status, docusignOn, signed }: { id: string; status: string; docusignOn: boolean; signed: boolean }) {
  const [pending, start] = useTransition();
  const [modal, setModal] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {status === "minuta" && docusignOn && (
        <button className="btn-gold w-full justify-center" disabled={pending}
          onClick={() => { setErr(null); start(() => sendForSignature(id).catch((e) => setErr(e.message))); }}>
          Enviar para assinatura (Docusign)
        </button>
      )}
      {(status === "minuta" || status === "enviado") && (
        <button className="btn-ghost w-full justify-center" onClick={() => { setErr(null); setModal(true); }}>
          Registrar assinatura manual
        </button>
      )}
      {signed && (
        <button className="btn-ghost w-full justify-center" disabled={pending}
          onClick={() => start(() => reexecuteKickoff(id).then(() => {}))}>
          Reexecutar kickoff
        </button>
      )}
      {err && <p className="text-sm text-red-400">{err}</p>}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setModal(false)}>
          <div className="card p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-2xl font-semibold mb-2">Registrar assinatura manual</h3>
            <p className="text-sm text-muted mb-4">Envie o PDF assinado. Isso marca o contrato como assinado (imutável) e dispara o kickoff.</p>
            <form action={registerManualSignature.bind(null, id)} className="space-y-3" onSubmit={() => setTimeout(() => setModal(false), 50)}>
              <div><label className="label">Nome do signatário</label><input className="input" name="signer_name" /></div>
              <div><label className="label">E-mail do signatário</label><input className="input" name="signer_email" type="email" /></div>
              <div><label className="label">PDF assinado</label>
                <input className="block w-full text-sm text-muted file:btn-gold file:mr-4 file:border-0" type="file" name="file" accept="application/pdf" required /></div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn-gold">Confirmar assinatura</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
