/**
 * DS v5 · Navegação local (Salestrack AI v2)
 * Tabs (client, teclado ←/→) · Breadcrumbs · Stepper/Wizard.
 */
"use client";
import { useState } from "react";
import { cn } from "@/lib/ds/cn";

export function Tabs({ tabs, defaultTab, onChange, className }: {
  tabs: { id: string; label: string; content?: React.ReactNode }[]; defaultTab?: string;
  onChange?: (id: string) => void; className?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const pick = (id: string) => { setActive(id); onChange?.(id); };
  return (
    <div className={className}>
      <div role="tablist" className="flex items-center gap-1 border-b border-hairline">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} role="tab" aria-selected={on} id={`tab-${t.id}`} aria-controls={`panel-${t.id}`}
              onClick={() => pick(t.id)}
              onKeyDown={(e) => {
                const i = tabs.findIndex((x) => x.id === active);
                if (e.key === "ArrowRight") pick(tabs[(i + 1) % tabs.length].id);
                if (e.key === "ArrowLeft") pick(tabs[(i - 1 + tabs.length) % tabs.length].id);
              }}
              className={cn("ds-focus -mb-px border-b-2 px-3.5 py-2.5 font-montserrat text-sm font-medium transition-colors",
                on ? "border-brand text-[color:var(--fg-1)]" : "border-transparent text-[color:var(--fg-3)] hover:text-[color:var(--fg-1)]")}>
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => t.id === active && t.content != null && (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} className="pt-5 ds-animate-in">{t.content}</div>
      ))}
    </div>
  );
}

export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-[14px]", className)}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {it.href && !last
              ? <a href={it.href} className="ds-focus text-[color:var(--fg-3)] hover:text-[color:var(--brand)]">{it.label}</a>
              : <span className={last ? "font-medium text-[color:var(--fg-1)]" : "text-[color:var(--fg-3)]"} aria-current={last ? "page" : undefined}>{it.label}</span>}
            {!last && <span className="text-[color:var(--fg-4)]">/</span>}
          </span>
        );
      })}
    </nav>
  );
}

export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={i} className="flex items-center gap-2">
            <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full font-jbmono text-xs font-medium",
              active ? "bg-brand text-white shadow-ds-brand" : done ? "bg-[var(--tile)] text-[color:var(--brand-deep)]" : "bg-[var(--gray-100)] text-[color:var(--fg-3)]")}>
              {done ? "✓" : i + 1}
            </span>
            <span className={cn("font-montserrat text-[14px]", active ? "font-semibold text-[color:var(--fg-1)]" : "text-[color:var(--fg-3)]")}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-[var(--border-strong)]" />}
          </li>
        );
      })}
    </ol>
  );
}
