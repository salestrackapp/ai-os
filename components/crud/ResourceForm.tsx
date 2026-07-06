"use client";
/** Formulário gerado a partir do `schema`/`fields` do recurso — valida no cliente (zod) e salva via server action. */
import { useState } from "react";
import { Label, Input, Textarea, Select } from "@/components/ds";
import { crudCreate, crudUpdate } from "@/lib/crud/actions";
import { getResource } from "@/lib/crud/registry";

export function ResourceForm({ resourceName, mode, id, initial, onSaved, onCancel, onResult }: {
  resourceName: string; mode: "create" | "edit"; id?: string;
  initial?: Record<string, unknown>; onSaved?: () => void; onCancel?: () => void; onResult?: (msg: string, ok: boolean) => void;
}) {
  const def = getResource(resourceName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    // validação no cliente com o MESMO schema do servidor
    const obj: Record<string, unknown> = {};
    for (const f of def.fields) obj[f.name] = f.type === "boolean" ? form.get(f.name) != null : form.get(f.name);
    const parsed = def.schema.safeParse(obj);
    if (!parsed.success) { setError(parsed.error.errors[0]?.message ?? "Confira os campos."); return; }
    setBusy(true);
    const res = mode === "create" ? await crudCreate(resourceName, form) : await crudUpdate(resourceName, id!, form);
    setBusy(false);
    if (res.ok) { onResult?.(res.message, true); onSaved?.(); } else { setError(res.message); onResult?.(res.message, false); }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {def.fields.map((f) => {
        const val = initial?.[f.name] ?? f.default;
        if (f.type === "boolean") {
          return (
            <label key={f.name} className="flex items-center gap-2.5">
              <input type="checkbox" name={f.name} defaultChecked={!!val} className="ds-focus h-4 w-4 accent-[color:var(--brand)]" />
              <span className="font-montserrat text-[13px] text-[color:var(--fg-1)]">{f.label}</span>
            </label>
          );
        }
        return (
          <div key={f.name}>
            <Label htmlFor={`f-${f.name}`} required={f.required}>{f.label}</Label>
            {f.type === "textarea"
              ? <Textarea id={`f-${f.name}`} name={f.name} defaultValue={val != null ? String(val) : ""} placeholder={f.placeholder} />
              : f.type === "select"
              ? <Select id={`f-${f.name}`} name={f.name} defaultValue={val != null ? String(val) : ""}>{(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
              : <Input id={`f-${f.name}`} name={f.name} type={f.type === "number" ? "number" : "text"} step={f.step} min={f.min} max={f.max} defaultValue={val != null ? String(val) : ""} placeholder={f.placeholder} />}
            {f.help && <p className="ds-small mt-1">{f.help}</p>}
          </div>
        );
      })}
      {error && <p className="rounded-ds-input border border-[color:rgba(229,104,95,0.3)] bg-[var(--danger-tint)] px-3 py-2 text-[13px] text-[color:var(--danger)]">{error}</p>}
      <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
        {onCancel && <button type="button" onClick={onCancel} className="ds-focus rounded-ds-input px-4 py-2 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Cancelar</button>}
        <button type="submit" disabled={busy} className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand transition-colors hover:bg-brand-hover disabled:opacity-45">
          {busy ? "Salvando…" : mode === "create" ? `Criar ${def.singular}` : "Salvar"}
        </button>
      </div>
    </form>
  );
}
