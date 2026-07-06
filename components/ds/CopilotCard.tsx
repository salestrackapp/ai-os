/**
 * DS v5 · CopilotCard (Salestrack AI v2)
 * Copiloto proativo — relata um ACHADO e propõe uma AÇÃO. Nunca "como posso ajudar?".
 * Estado = dot + rótulo minúsculo (ativo/rodando/em curso). Base do Consultor/Copiloto.
 * API: <CopilotCard agent status finding action onAction? metric? />
 */
"use client";
import { cn } from "@/lib/ds/cn";
import { StatusDot } from "./primitives";
import { Button } from "./Button";

export function CopilotCard({ agent = "Copiloto", status = "ativo", finding, actionLabel, onAction, metric, className }: {
  agent?: string; status?: string; finding: string; actionLabel?: string;
  onAction?: () => void; metric?: { value: string; label: string }; className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-ds-card p-5 text-white shadow-ds-brand", className)} style={{ background: "var(--grad-brand)" }}>
      <span aria-hidden className="absolute right-4 top-4 text-spark">✳</span>
      <div className="flex items-center gap-2 text-white/85">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/15">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.29 1.29L3 12l5.8 1.9a2 2 0 0 1 1.29 1.29L12 21l1.9-5.8a2 2 0 0 1 1.29-1.29L21 12l-5.8-1.9a2 2 0 0 1-1.29-1.29Z" /></svg>
        </span>
        <span className="font-montserrat text-[13px] font-semibold">{agent}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-white/80">
          <span className="h-1.5 w-1.5 rounded-full bg-spark ds-dot-live" /> {status}
        </span>
      </div>
      <p className="mt-3 font-montserrat text-[15px] font-medium leading-snug text-white">{finding}</p>
      {metric && (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-montserrat text-2xl font-extrabold tracking-[-0.02em] text-white tabular-nums">{metric.value}</span>
          <span className="text-xs text-white/75">{metric.label}</span>
        </div>
      )}
      {actionLabel && (
        <div className="mt-4">
          <Button variant="accent" size="sm" onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  );
}

/** Versão discreta (fundo claro) para quando o card gradiente pesar demais na tela. */
export function CopilotInline({ agent = "Copiloto", finding, actionLabel, onAction, className }: {
  agent?: string; finding: string; actionLabel?: string; onAction?: () => void; className?: string;
}) {
  return (
    <div className={cn("rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4 shadow-ds-xs", className)}>
      <div className="mb-2"><StatusDot status="ativo" live /></div>
      <p className="ds-body font-medium text-[color:var(--fg-1)]"><span className="text-[color:var(--brand)]">{agent}:</span> {finding}</p>
      {actionLabel && <div className="mt-3"><Button variant="primary" size="sm" onClick={onAction}>{actionLabel}</Button></div>}
    </div>
  );
}
