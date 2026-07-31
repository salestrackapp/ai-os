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

export function CopilotCard({ agent = "Copiloto", status = "ativo", finding, actionLabel, onAction, metric, className, tone = "brand", compact = false, rodape }: {
  agent?: string; status?: string; finding: string; actionLabel?: string;
  onAction?: () => void; metric?: { value: string; label: string }; className?: string;
  /** brand (padrão) · atencao · grave. Só muda a cor de fundo; a estrutura é a mesma. */
  tone?: "brand" | "atencao" | "grave";
  /**
   * Versão apertada, para quando vários cards dividem a mesma faixa da tela. Um card sozinho pode
   * respirar; seis lado a lado com a mesma folga empurram o resto da página para fora da dobra.
   */
  compact?: boolean;
  /** Linha miúda no pé — de onde veio o achado. Fica DENTRO do card para as alturas baterem. */
  rodape?: string;
}) {
  /**
   * `flex h-full flex-col` no card e `mt-auto` no botão: é o que faz um card de duas linhas ficar
   * da mesma altura de um de quatro, com os botões alinhados na fileira. Sem isso, cada card
   * termina onde seu texto acabou e a linha vira escada.
   */
  return (
    <div className={cn("relative flex h-full flex-col overflow-hidden rounded-ds-card text-white shadow-ds-brand", compact ? "p-4" : "p-5", className)} style={{ background: FUNDO[tone] ?? FUNDO.brand }}>
      <span aria-hidden className="absolute right-3 top-3 text-spark">✳</span>
      {/* pr-6 reserva o canto do ✳: sem isso, um rótulo de estado mais longo que "ativo" passa por baixo dele. */}
      <div className="flex items-center gap-2 pr-6 text-white/85">
        <span className={cn("inline-flex items-center justify-center rounded-md bg-white/15", compact ? "h-5 w-5" : "h-6 w-6")}>
          <svg width={compact ? 12 : 14} height={compact ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.29 1.29L3 12l5.8 1.9a2 2 0 0 1 1.29 1.29L12 21l1.9-5.8a2 2 0 0 1 1.29-1.29L21 12l-5.8-1.9a2 2 0 0 1-1.29-1.29Z" /></svg>
        </span>
        <span className={cn("font-montserrat font-semibold", compact ? "text-[13px]" : "text-[14px]")}>{agent}</span>
        <span className={cn("ml-auto inline-flex items-center gap-1.5 font-medium text-white/80", compact ? "text-[12px]" : "text-[13px]")}>
          <span className="h-1.5 w-1.5 rounded-full bg-spark ds-dot-live" /> {status}
        </span>
      </div>
      <p className={cn("font-montserrat font-medium leading-snug text-white", compact ? "mt-2 text-[13.5px]" : "mt-3 text-[15px]")}>{finding}</p>
      {metric && (
        <div className={cn("flex items-baseline gap-2", compact ? "mt-1.5" : "mt-3")}>
          <span className={cn("font-montserrat font-extrabold tracking-[-0.02em] text-white tabular-nums", compact ? "text-lg" : "text-2xl")}>{metric.value}</span>
          <span className="text-xs text-white/75">{metric.label}</span>
        </div>
      )}
      {actionLabel && (
        <div className={cn("mt-auto", compact ? "pt-3" : "pt-4")}>
          <Button variant="accent" size="sm" onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
      {rodape && <p className="mt-2 font-montserrat text-[11.5px] leading-snug text-white/60">{rodape}</p>}
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
