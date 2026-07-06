/**
 * DS v5 · Campos de formulário (Salestrack AI v2)
 * Label · Input · Textarea · Select · Field (wrapper com label/hint/erro).
 * Foco ring violeta 3px. Label visível (nunca só placeholder). Erro abaixo do campo.
 */
"use client";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/ds/cn";

const baseField =
  "ds-focus w-full rounded-ds-input border bg-[var(--bg-1)] px-3.5 py-2.5 font-montserrat text-sm text-[color:var(--fg-1)] " +
  "placeholder:text-[color:var(--fg-4)] border-hairline-strong transition-[border-color,box-shadow] duration-150 " +
  "hover:border-[color:var(--brand-light)] disabled:opacity-45 disabled:pointer-events-none";

export function Label({ children, htmlFor, required, className }: {
  children: React.ReactNode; htmlFor?: string; required?: boolean; className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block font-montserrat text-[13px] font-medium text-[color:var(--fg-2)]", className)}>
      {children}{required && <span className="ml-0.5 text-[color:var(--danger)]">*</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(baseField, className)} {...rest} />;
  });

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(baseField, "resize-y", className)} {...rest} />;
  });

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return <select ref={ref} className={cn(baseField, "appearance-none pr-9 bg-[right_0.75rem_center] bg-no-repeat", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236B6B7C' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")" }}
      {...rest}>{children}</select>;
  });

/** Wrapper acessível: liga label ao campo e mostra hint/erro. */
export function Field({ label, hint, error, required, children, className }: {
  label?: string; hint?: string; error?: string; required?: boolean;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode; className?: string;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cn("w-full", className)}>
      {label && <Label htmlFor={id} required={required}>{label}</Label>}
      {children({ id, "aria-invalid": !!error || undefined, "aria-describedby": (hint || error) ? descId : undefined })}
      {error
        ? <p id={descId} className="mt-1.5 text-xs text-[color:var(--danger)]">{error}</p>
        : hint ? <p id={descId} className="ds-small mt-1.5">{hint}</p> : null}
    </div>
  );
}
