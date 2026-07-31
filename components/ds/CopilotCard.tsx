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

/**
 * O fundo do card carrega a gravidade.
 *
 * Sem isto, seis achados lado a lado ficam idênticos — e uma fatura vencida há 19 dias compete em
 * pé de igualdade com "publicar um relatório de ROI". Hierarquia visual não é enfeite aqui: é o que
 * decide o que a pessoa olha primeiro.
 */
// Os dois tons foram escolhidos pelo contraste com o texto branco que vive em cima deles, não pela
// aparência: #B91C1C dá 6,5:1 e #9A3412 dá 7,1:1. O laranja mais claro que eu queria usar no
// "atenção" ficava em 4,0:1 — bonito e ilegível no corpo de 15px.
const FUNDO: Record<string, string> = {
  brand: "var(--grad-brand)",
  grave: "linear-gradient(135deg, #7F1D1D 0%, #B91C1C 100%)",
  atencao: "linear-gradient(135deg, #7C2D12 0%, #9A3412 100%)",
};

export function CopilotCard({ agent = "Copiloto", status = "ativo", finding, actionLabel, onAction, metric, className, tone = "brand" }: {
  agent?: string; status?: string; finding: string; actionLabel?: string;
  onAction?: () => void; metric?: { value: string; label: string }; className?: string;
  /** brand (padrão) · atencao · grave. Só muda a cor de fundo; a estrutura é a mesma. */
  tone?: "brand" | "atencao" | "grave";
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-ds-card p-5 text-white shadow-ds-brand", className)} style={{ background: FUNDO[tone] ?? FUNDO.brand }}>
      <span aria-hidden className="absolute right-4 top-4 text-spark">✳</span>
      <div className="flex items-center gap-2 text-white/85">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/15">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.29 1.29L3 12l5.8 1.9a2 2 0 0 1 1.29 1.29L12 21l1.9-5.8a2 2 0 0 1 1.29-1.29L21 12l-5.8-1.9a2 2 0 0 1-1.29-1.29Z" /></svg>
        </span>
        <span className="font-montserrat text-[14px] font-semibold">{agent}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-white/80">
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
