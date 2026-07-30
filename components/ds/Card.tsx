/**
 * DS v6 · Card (identidade Academy)
 * Card — superfície branca, hairline, sombra suave, tile de ícone ciano no topo.
 * CardFeatured — fundo gradiente navy, texto branco (item atual/recomendado/flagship).
 * API: <Card icon title eyebrow footer bloom>…</Card> · <CardFeatured icon title>…</CardFeatured>
 */
import { cn } from "@/lib/ds/cn";
import { IconTile } from "./primitives";

export function Card({ icon, eyebrow, title, children, footer, bloom, className }: {
  icon?: React.ReactNode; eyebrow?: string; title?: string; children?: React.ReactNode;
  footer?: React.ReactNode; bloom?: boolean; className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-[14px] border border-hairline bg-[var(--bg-1)] p-6", className)}>
      {bloom && <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--wash-bloom)" }} />}
      <div className="relative">
        {icon && <IconTile className="mb-4">{icon}</IconTile>}
        {eyebrow && <p className="ds-eyebrow mb-2">{eyebrow}</p>}
        {title && <h3 className="ds-h3 mb-2">{title}</h3>}
        {children && <div className="ds-body text-[color:var(--fg-2)]">{children}</div>}
        {footer && <div className="mt-5 border-t border-hairline pt-4">{footer}</div>}
      </div>
    </div>
  );
}

export function CardFeatured({ icon, eyebrow, title, children, footer, className }: {
  icon?: React.ReactNode; eyebrow?: string; title?: string; children?: React.ReactNode;
  footer?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-ds-card p-6 text-white shadow-ds-brand", className)} style={{ background: "var(--grad-brand)" }}>
      {/* spark glyph — motivo de marca, canto superior direito */}
      <span aria-hidden className="absolute right-4 top-4 text-spark opacity-90">✳</span>
      {icon && <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15 text-white">{icon}</span>}
      {eyebrow && <p className="mb-2 inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.2em] text-white/85"><span className="h-px w-4 bg-white/70" />{eyebrow}</p>}
      {title && <h3 className="font-montserrat text-[22px] font-bold leading-tight tracking-[-0.02em]">{title}</h3>}
      {children && <div className="mt-2 text-[15px] leading-relaxed text-white/85">{children}</div>}
      {footer && <div className="mt-5 border-t border-white/20 pt-4">{footer}</div>}
    </div>
  );
}
