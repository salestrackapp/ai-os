"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label, Input, Select } from "@/components/ds";
import { createBlankPrograma } from "@/lib/crud/programa-actions";

export function BlankProgramForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setError(null); setBusy(true);
      const res = await createBlankPrograma(new FormData(e.currentTarget));
      setBusy(false);
      if (res.ok && res.id) router.push(`/admin/programas/${res.id}/editar`);
      else setError(res.message);
    }} className="space-y-4">
      <div><Label htmlFor="np-org" required>Cliente</Label>
        <Select id="np-org" name="org_id" required defaultValue="">
          <option value="" disabled>Selecione o cliente…</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </div>
      <div><Label htmlFor="np-name" required>Nome do programa</Label>
        <Input id="np-name" name="name" placeholder="Ex.: Programa de IA — Clínica" required />
      </div>
      {error && <p className="rounded-ds-input border border-[color:rgba(229,104,95,0.3)] bg-[var(--danger-tint)] px-3 py-2 text-[13px] text-[color:var(--danger)]">{error}</p>}
      <button type="submit" disabled={busy} className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-45">{busy ? "Criando…" : "Criar e abrir editor"}</button>
    </form>
  );
}
