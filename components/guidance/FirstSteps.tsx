import Link from "next/link";
import type { Guide } from "@/lib/guidance/first-steps";
import { markGuideStep, dismissGuide, reopenGuide } from "@/lib/guidance/actions";
import { Icon } from "@/components/ui/icons";

/**
 * "Primeiros passos" — painel dispensável, não bloqueante, com % real (guia por usuário).
 * Fechado pelo usuário → fica fechado; reabre por um link discreto. Nunca reaparece sozinho.
 */
export function FirstSteps({ surface, guide }: { surface: "admin" | "portal"; guide: Guide }) {
  if (guide.dismissed) {
    return (
      <form action={reopenGuide.bind(null, surface)} className="mb-6">
        <button className="ds-focus inline-flex items-center gap-1.5 font-montserrat text-[13px] font-medium text-[color:var(--fg-3)] hover:text-[color:var(--brand)]">
          <Icon name="rocket" size={13} /> Reabrir os primeiros passos
        </button>
      </form>
    );
  }
  const doneCount = guide.steps.filter((s) => s.done).length;

  return (
    <div className="mb-7 overflow-hidden rounded-ds-card border border-hairline bg-[var(--bg-1)] shadow-ds-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--tile)] text-[color:var(--brand)]"><Icon name="rocket" size={15} /></span>
          <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Primeiros passos</p>
          <span className="font-jbmono text-[13px] text-[color:var(--fg-3)]">{doneCount}/{guide.steps.length}</span>
        </div>
        <form action={dismissGuide.bind(null, surface)}>
          <button className="ds-focus rounded-[8px] px-2 py-1 font-montserrat text-[13px] text-[color:var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[color:var(--fg-1)]">Dispensar</button>
        </form>
      </div>
      <div className="mt-3 h-1.5 w-full bg-[var(--gray-100)]">
        <div className="h-full transition-[width] duration-500" style={{ width: `${guide.pct}%`, background: "var(--grad-brand)" }} />
      </div>
      <ul className="divide-y divide-[var(--border)] px-2 py-1.5">
        {guide.steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 px-3 py-2.5">
            <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${s.done ? "border-transparent bg-[color:var(--success)] text-white" : "border-hairline-strong text-transparent"}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <Link href={s.href} className={`min-w-0 flex-1 font-montserrat text-[14px] ${s.done ? "text-[color:var(--fg-3)] line-through" : "text-[color:var(--fg-1)] hover:text-[color:var(--brand)]"}`}>{s.label}</Link>
            {!s.done && (
              <div className="flex items-center gap-2">
                <Link href={s.href} className="font-montserrat text-[13px] font-medium text-[color:var(--brand)] hover:underline">abrir</Link>
                <form action={markGuideStep.bind(null, surface, s.key)}><button className="ds-focus rounded-[8px] border border-hairline-strong px-2 py-1 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">marcar</button></form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
