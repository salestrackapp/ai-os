/**
 * DS v6 · A definição visual do botão, em módulo SEM "use client".
 *
 * Mora separado de Button.tsx de propósito: aquele é um componente de cliente, e uma função
 * exportada de lá não pode ser chamada de uma página de servidor — a maior parte das telas do
 * AI OS é servidor, e é justamente nelas que os <Link href> precisam das classes.
 *
 * Fonte única: Button.tsx consome estas mesmas tabelas. Mexer aqui muda todos os botões.
 */
import { cn } from "@/lib/ds/cn";

export type BotaoVariante = "primary" | "accent" | "secondary" | "ghost";
export type BotaoTamanho = "sm" | "md" | "lg";

export const BOTAO_BASE =
  "ds-focus inline-flex select-none items-center justify-center border font-montserrat font-semibold "
  + "transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ds-ease)] "
  + "active:scale-[.98] disabled:opacity-45 disabled:pointer-events-none";

export const BOTAO_VARIANTE: Record<BotaoVariante, string> = {
  primary: "bg-brand text-white border-transparent shadow-ds-brand hover:bg-brand-hover",
  accent: "bg-spark text-ink border-transparent hover:brightness-95",   // faísca: só texto escuro em cima
  secondary: "bg-[var(--bg-1)] text-[color:var(--fg-1)] border-hairline-strong hover:bg-[var(--bg-2)]",
  ghost: "bg-transparent text-[color:var(--fg-2)] border-transparent hover:bg-[var(--bg-2)]",
};

export const BOTAO_TAMANHO: Record<BotaoTamanho, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-10 px-4 text-sm gap-2 rounded-ds-input",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-ds-input",
};

/** Classes do botão para elementos que não são <button> — tipicamente <Link href>. */
export function botaoClasses(opts?: { variant?: BotaoVariante; size?: BotaoTamanho; className?: string }) {
  return cn(BOTAO_BASE, BOTAO_VARIANTE[opts?.variant ?? "primary"], BOTAO_TAMANHO[opts?.size ?? "md"], opts?.className);
}
