"use client";
import { useState } from "react";
import { approveProposal, requestAdjust, refuseProposal } from "@/app/p/[token]/actions";

type Modal = "approve" | "adjust" | "refuse" | null;

export function DecisionBar({ token }: { token: string }) {
  const [modal, setModal] = useState<Modal>(null);
  const [name, setName] = useState(""); const [role, setRole] = useState("");
  const [agree, setAgree] = useState(false); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean }>) {
    setBusy(true); setErr(null);
    try { await fn(); window.location.reload(); }
    catch (e) { setBusy(false); setErr((e as Error).message); }
  }

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-40 bg-navy2/95 backdrop-blur border-t border-line">
        <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Pronto para decidir?</p>
          <div className="flex gap-2">
            <button className="btn-ghost !text-muted2 hover:!text-red-400" onClick={() => { setNote(""); setErr(null); setModal("refuse"); }}>Recusar</button>
            <button className="btn-ghost" onClick={() => { setNote(""); setErr(null); setModal("adjust"); }}>Solicitar ajuste</button>
            <button className="btn-gold" onClick={() => { setName(""); setRole(""); setAgree(false); setErr(null); setModal("approve"); }}>Aprovar</button>
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6" onClick={() => !busy && setModal(null)}>
          <div className="card p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            {modal === "approve" && (
              <>
                <h3 className="font-serif text-2xl font-semibold mb-4">Aprovar proposta</h3>
                <div className="space-y-3">
                  <div><label className="label">Nome completo</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
                  <div><label className="label">Cargo</label><input className="input" value={role} onChange={(e) => setRole(e.target.value)} /></div>
                  <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="accent-[#4F1FFF]" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Li e aprovo esta proposta</label>
                </div>
                {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
                <div className="mt-5 flex gap-3 justify-end">
                  <button className="btn-ghost" onClick={() => setModal(null)} disabled={busy}>Cancelar</button>
                  <button className="btn-gold" disabled={busy || !name.trim() || !role.trim() || !agree} onClick={() => run(() => approveProposal(token, { name, role }))}>{busy ? "Enviando…" : "Confirmar aprovação"}</button>
                </div>
              </>
            )}
            {(modal === "adjust" || modal === "refuse") && (
              <>
                <h3 className="font-serif text-2xl font-semibold mb-2">{modal === "adjust" ? "Solicitar ajuste" : "Recusar proposta"}</h3>
                <p className="text-sm text-muted mb-4">{modal === "adjust" ? "O que precisa ser ajustado?" : "Qual o motivo da recusa?"}</p>
                <textarea className="input" rows={4} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
                {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
                <div className="mt-5 flex gap-3 justify-end">
                  <button className="btn-ghost" onClick={() => setModal(null)} disabled={busy}>Cancelar</button>
                  <button className="btn-gold" disabled={busy || !note.trim()}
                    onClick={() => run(() => modal === "adjust" ? requestAdjust(token, { note }) : refuseProposal(token, { note }))}>
                    {busy ? "Enviando…" : "Confirmar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
