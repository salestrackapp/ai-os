/**
 * DS v5 · Button (Salestrack AI v2)
 * Variantes: primary (violeta, sombra de marca) · accent (lime, raríssimo) · secondary · ghost.
 * Regra: UMA primary por tela. Press scale(.98). Foco ring violeta. Estado loading desabilita.
 * API: <Button variant size loading disabled leftIcon>…</Button> (herda props de <button>).
 */
"use client";
import { forwardRef } from "react";
import { cn } from "@/lib/ds/cn";

type Variant = "primary" | "accent" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white border-transparent shadow-ds-brand hover:bg-brand-hover",
  accent: "bg-spark text-ink border-transparent hover:brightness-95",   // lime: só texto escuro (nunca claro sobre lime)
  secondary: "bg-[var(--bg-1)] text-[color:var(--fg-1)] border-hairline-strong hover:bg-[var(--bg-2)]",
  ghost: "bg-transparent text-[color:var(--fg-2)] border-transparent hover:bg-[var(--bg-2)]",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-10 px-4 text-sm gap-2 rounded-ds-input",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-ds-input",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; leftIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, leftIcon, disabled, className, children, ...rest }, ref,
) {
  return (
    <button
      ref={ref} disabled={disabled || loading}
      className={cn(
        "ds-focus inline-flex select-none items-center justify-center border font-montserrat font-semibold",
        "transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ds-ease)]",
        "active:scale-[.98] disabled:opacity-45 disabled:pointer-events-none",
        VARIANT[variant], SIZE[size], className,
      )}
      {...rest}
    >
      {loading
        ? <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        : leftIcon}
      {children}
    </button>
  );
});
