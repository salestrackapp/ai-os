/**
 * DS v6 · Button — a ÚNICA definição de botão do sistema.
 * Variantes: primary (ciano, sombra de marca) · accent (faísca, raríssimo) · secondary · ghost.
 * Regra: UMA primary por tela. Press scale(.98). Foco ring ciano. Estado loading desabilita.
 * API: <Button variant size loading disabled leftIcon>…</Button> (herda props de <button>).
 *
 * A aparência vive em ./button-classes.ts (módulo sem "use client", para que as páginas de
 * servidor possam usá-la). Para <Link> e <a>, use `botaoClasses()` de lá — mesma fonte.
 * Existiam TRÊS primárias paralelas e elas divergiram de verdade: a `.btn-gold` do tema legado
 * ficou com o gradiente navy enquanto esta ficou ciano, então o mesmo botão saía de duas cores
 * conforme a tela.
 */
"use client";
import { forwardRef } from "react";
import { cn } from "@/lib/ds/cn";
import { BOTAO_BASE, BOTAO_VARIANTE, BOTAO_TAMANHO, type BotaoVariante, type BotaoTamanho } from "./button-classes";

type Variant = BotaoVariante;
type Size = BotaoTamanho;


export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; leftIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, leftIcon, disabled, className, children, ...rest }, ref,
) {
  return (
    <button
      ref={ref} disabled={disabled || loading}
      className={cn(BOTAO_BASE, BOTAO_VARIANTE[variant], BOTAO_TAMANHO[size], className)}
      {...rest}
    >
      {loading
        ? <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        : leftIcon}
      {children}
    </button>
  );
});
