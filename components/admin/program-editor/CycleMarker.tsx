"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AI_METHOD } from "@/lib/ds/method";
import { setCycleStep } from "@/lib/crud/programa-actions";

/** Marca em qual passo do AI Operating Method o programa está — isso aparece na Jornada do cliente. */
export function CycleMarker({ projectId, current }: { projectId: string; current: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function pick(i: number) {
    if (busy || i === current) return;
    setBusy(true);
    await setCycleStep(projectId, i);
    setBusy(false); router.refresh();
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {AI_METHOD.map((s, i) => {
        const on = i === current;
        return (
          <button key={s.key} onClick={() => pick(i)} disabled={busy} aria-pressed={on}
            className="ds-focus rounded-ds-card border p-3 text-left transition-colors disabled:opacity-60"
            style={on ? { background: "var(--grad-brand)", borderColor: "transparent", color: "#fff" } : { background: "var(--bg-1)", borderColor: "var(--border)" }}>
            <span className={`block font-jbmono text-[11px] ${on ? "text-white/75" : "text-[color:var(--fg-3)]"}`}>etapa {i + 1}/5</span>
            <span className={`block font-montserrat text-[14px] font-semibold ${on ? "text-white" : "text-[color:var(--fg-1)]"}`}>{s.title}</span>
          </button>
        );
      })}
    </div>
  );
}
