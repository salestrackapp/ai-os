/**
 * DS v6 · Primitivas de texto e dado (identidade Academy)
 * Eyebrow · Section · Kpi · Badge · StatusDot · MonoTag · EmptyState · PrimaryActionBar
 * Todas herdam tokens; texto em sentence case; caixa alta só no eyebrow-assinatura.
 */
import { cn } from "@/lib/ds/cn";

/** Rótulo-assinatura: `— LABEL` em caixa alta ciano, tracking largo. Único uso de caixa alta. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("ds-eyebrow", className)}>{children}</span>;
}

/** Seção com eyebrow-assinatura opcional + título sentence case. */
export function Section({ eyebrow, title, subtitle, children, className }: {
  eyebrow?: string; title?: string; subtitle?: string; children?: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {(eyebrow || title || subtitle) && (
        <header className="space-y-2">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          {title && <h2 className="ds-h2">{title}</h2>}
          {subtitle && <p className="ds-lead max-w-2xl">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

/** KPI — "dado como insight": figura grande em negrito + legenda minúscula. */
export function Kpi({ value, label, delta, tone = "neutral", className }: {
  value: React.ReactNode; label: string; delta?: string; tone?: "neutral" | "up" | "down"; className?: string;
}) {
  const deltaColor = tone === "up" ? "text-[color:var(--success)]" : tone === "down" ? "text-[color:var(--danger)]" : "text-[color:var(--fg-3)]";
  return (
    <div className={cn("rounded-ds-card border border-hairline bg-[var(--bg-1)] p-5 shadow-ds-xs", className)}>
      <div className="flex items-baseline gap-2">
        <span className="font-montserrat font-extrabold tracking-[-0.03em] text-[clamp(28px,3vw,40px)] leading-none text-[color:var(--fg-1)] tabular-nums">{value}</span>
        {delta && <span className={cn("font-montserrat text-xs font-semibold", deltaColor)}>{delta}</span>}
      </div>
      <p className="ds-small mt-2 uppercase tracking-[0.08em] text-[11px]">{label}</p>
    </div>
  );
}

/**
 * Selo no formato do .acad-badge: pílula tingida, sem borda.
 * As bordas saíram junto com o `border` do Badge — traziam hex fixos da paleta v5
 * (o violeta e seus tons) e teriam ficado como resíduo dela.
 */
const BADGE_TONE: Record<string, string> = {
  neutral: "bg-[var(--gray-100)] text-[color:var(--fg-2)]",
  brand: "bg-[var(--tile)] text-[color:var(--brand-deep)]",
  success: "bg-[var(--success-tint)] text-[color:var(--success)]",
  warn: "bg-[var(--warn-tint)] text-[color:var(--warn)]",
  danger: "bg-[var(--danger-tint)] text-[color:var(--danger)]",
};

/** Pill de rótulo. Sentence case. */
export function Badge({ children, tone = "neutral", className }: {
  children: React.ReactNode; tone?: keyof typeof BADGE_TONE; className?: string;
}) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-ds-pill px-2.5 py-[3px] text-xs font-bold font-montserrat", BADGE_TONE[tone], className)}>{children}</span>;
}

const DOT_COLOR: Record<string, string> = {
  ativo: "var(--success)", rodando: "var(--brand)", "em curso": "var(--brand-light)",
  pausado: "var(--gray-400)", spark: "var(--accent)", alerta: "var(--danger)",
};

/** Status = dot colorido + rótulo minúsculo (não emoji). Ex.: ativo, rodando, em curso. */
export function StatusDot({ status, live, className }: { status: string; live?: boolean; className?: string }) {
  const color = DOT_COLOR[status] ?? "var(--gray-400)";
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-medium font-montserrat text-[color:var(--fg-2)]", className)}>
      <span className={cn("h-2 w-2 rounded-full", live && "ds-dot-live")} style={{ background: color, boxShadow: `0 0 0 3px ${color}22` }} />
      {status}
    </span>
  );
}

/** Tag técnica em mono (dado, URL, versão, id). */
export function MonoTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md border border-hairline bg-[var(--bg-2)] px-2 py-0.5 font-jbmono text-[13px] text-[color:var(--fg-3)]", className)}>{children}</span>;
}

/** Tile de ícone em ciano lavado (recebe ícone da marca). */
export function IconTile({ children, size = 40, className }: { children: React.ReactNode; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center rounded-[12px] text-[color:var(--brand)]", className)}
      style={{ width: size, height: size, background: "var(--tile)" }}>
      {children}
    </span>
  );
}

/** Estado vazio: tile + título + texto + UMA ação. */
export function EmptyState({ icon, title, description, action, guiaHref, className }: {
  icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; guiaHref?: string; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-ds-card border border-dashed border-hairline-strong bg-[var(--bg-1)] px-6 py-12 text-center", className)}>
      {icon && <IconTile size={48} className="mb-4">{icon}</IconTile>}
      <p className="ds-h3">{title}</p>
      {description && <p className="ds-small mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
      {guiaHref && <a href={guiaHref} className="mt-3 font-montserrat text-[14px] font-medium text-[color:var(--brand)] hover:underline">Ver o guia →</a>}
    </div>
  );
}

/** Barra de ação: garante uma primary; secundárias subordinadas à esquerda. */
export function PrimaryActionBar({ primary, secondary, className }: {
  primary: React.ReactNode; secondary?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t border-hairline pt-4", className)}>
      <div className="flex items-center gap-2">{secondary}</div>
      <div>{primary}</div>
    </div>
  );
}
