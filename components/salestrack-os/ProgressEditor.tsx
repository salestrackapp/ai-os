"use client";
import { useState } from "react";
import { updateProgress } from "@/app/admin/central/actions";
import type { Progress } from "@/lib/salestrack-os/model";
export function ProgressEditor({
  day,
  id,
  initial,
  onSaved,
}: {
  day: string;
  id: string;
  initial?: Progress;
  onSaved?: (status:Progress["status"])=>void;
}) {
  const [status, setStatus] = useState<Progress["status"]>(
      initial?.status || "pendente",
    ),
    [evidence, setEvidence] = useState(initial?.evidence || ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          await updateProgress({ day, id, status, evidence });
          setMessage("Salvo.");
          onSaved?.(status);
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Falha ao salvar.");
        } finally {
          setBusy(false);
        }
      }}
      className="mt-4 grid gap-3"
    >
      <label className="text-sm">
        Andamento
        <select
          className="input mt-1"
          value={status}
          onChange={(e) => setStatus(e.target.value as Progress["status"])}
        >
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="bloqueado">Bloqueado</option>
          <option value="concluido">Concluído</option>
        </select>
      </label>
      <label className="text-sm">
        Resultado, evidência ou bloqueio
        <textarea
          className="input mt-1"
          maxLength={2000}
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="O que foi feito, onde conferir e o que falta."
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} className="btn-gold text-sm">
          {busy ? "Salvando…" : "Registrar andamento"}
        </button>
        <span role="status" className="text-sm">
          {message}
        </span>
      </div>
    </form>
  );
}
