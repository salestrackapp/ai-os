/**
 * DS v5 · CycleSteps — o AI Operating Method™ (Salestrack AI v2)
 * Espinha do produto: 5 etapas em ciclo contínuo (recomeça todo mês).
 * Diagnosticar → Estruturar → Implementar → Capacitar → Evoluir.
 * A etapa ATUAL usa o card Featured (gradiente violeta→índigo, texto branco).
 * Aqui só a casca visual + props; lógica editável e vínculo a dados vêm em R2.5.
 * API: <CycleSteps steps? currentStep onEdit? />
 */
"use client";
import { cn } from "@/lib/ds/cn";
import { Eyebrow } from "./primitives";
import { AI_METHOD, type CycleStep } from "@/lib/ds/method";

export { AI_METHOD, type CycleStep };

function StepIcon({ i }: { i: number }) {
  const paths = [
    <path key="a" d="M11 3a8 8 0 1 0 5.29 14M21 21l-4.35-4.35" />,          // diagnosticar (lupa)
    <><rect key="b" x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>, // estruturar
    <><path key="c" d="M12 2v4" /><path d="m16 6-2 2" /><circle cx="12" cy="14" r="7" /><path d="M12 14l3-2" /></>, // implementar
    <><path key="d" d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>, // capacitar (graduation)
    <><path key="e" d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" /></>, // evoluir (chart up)
  ];
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{paths[i]}</svg>;
}

export function CycleSteps({ steps = AI_METHOD, currentStep = 2, onEdit }: {
  steps?: CycleStep[]; currentStep?: number; onEdit?: (key: string) => void;
}) {
  return (
    <div className="ds">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Eyebrow>AI OPERATING METHOD</Eyebrow>
          <p className="ds-small mt-1">Ciclo contínuo — recomeça a cada mês.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s, i) => {
          const current = i === currentStep;
          const done = i < currentStep;
          if (current) {
            return (
              <div key={s.key} className="relative overflow-hidden rounded-ds-card p-5 text-white shadow-ds-brand" style={{ background: "var(--grad-brand)" }}>
                <span aria-hidden className="absolute right-3 top-3 text-spark">✳</span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-white/15"><StepIcon i={i} /></span>
                <p className="mt-3 font-jbmono text-[11px] text-white/70">etapa {i + 1}/5 · em curso</p>
                <p className="font-montserrat text-lg font-bold tracking-[-0.02em]">{s.title}</p>
                <p className="mt-1 text-[13px] leading-snug text-white/85">{s.objective}</p>
                {onEdit && <button onClick={() => onEdit(s.key)} className="ds-focus mt-3 text-[12px] font-semibold text-spark underline-offset-2 hover:underline">Editar etapa</button>}
              </div>
            );
          }
          return (
            <div key={s.key} className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-5 shadow-ds-xs">
              <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-[11px]",
                done ? "bg-[var(--tile)] text-[color:var(--brand)]" : "bg-[var(--gray-100)] text-[color:var(--fg-3)]")}>
                <StepIcon i={i} />
              </span>
              <p className="mt-3 font-jbmono text-[11px] text-[color:var(--fg-3)]">etapa {i + 1}/5 · {done ? "concluída" : "prevista"}</p>
              <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">{s.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-[color:var(--fg-3)]">{s.objective}</p>
              {onEdit && <button onClick={() => onEdit(s.key)} className="ds-focus mt-3 text-[12px] font-semibold text-[color:var(--brand)] underline-offset-2 hover:underline">Editar etapa</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
