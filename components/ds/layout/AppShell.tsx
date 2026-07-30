/**
 * DS v6 · Primitivas de layout — a casca da Salestrack AI Academy, agora em todo o AI OS.
 *
 * Forma: barra superior navy de 60px com faixa ciano, barra lateral navy de 260px `position: fixed`,
 * conteúdo claro com `margin-left`. A margem é o ponto: com ela a sobreposição entre barra e
 * conteúdo é estruturalmente impossível — foi o que consertou o mesmo defeito na Academy.
 *
 * A marca vive na barra SUPERIOR (não na lateral, como no v5), porque é assim na Academy.
 */
"use client";
import { useState } from "react";
import { cn } from "@/lib/ds/cn";
import { Eyebrow } from "../primitives";

export type NavItem = {
  label: string; href: string; icon?: React.ReactNode; active?: boolean; dataTour?: string;
  /** Subitens. Quando existem, o item vira um grupo que abre e fecha. */
  children?: NavItem[];
};
export type NavGroup = { title?: string; items: NavItem[] };

const LINHA = "ds-focus flex items-center gap-3 border-l-[3px] px-5 py-2.5 font-montserrat text-[14px] transition-colors";
const ATIVO = "border-l-[color:var(--brand-light)] bg-[rgba(0,180,216,.12)] font-semibold text-white";
const INATIVO = "border-l-transparent text-white/60 hover:bg-white/[.06] hover:text-white";

function Chevron({ aberto }: { aberto: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden
      className={cn("ml-auto shrink-0 transition-transform", aberto && "rotate-180")}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Item com subitens.
 *
 * Duas coisas que o desenho resolve:
 *
 *  1. **O destino continua clicável.** O rótulo é um link para a página do destino; só o chevron
 *     abre e fecha. Transformar o pai inteiro em botão de expandir tiraria o acesso à visão geral
 *     da área — que é justamente onde estão as descrições de cada tela.
 *  2. **Abre sozinho quando você está dentro.** Chegar numa subtela por link e ver o menu fechado
 *     esconde onde você está; e obrigar a expandir de novo a cada navegação é fricção que não
 *     ensina nada.
 */
function ItemComFilhos({ item }: { item: NavItem }) {
  const temFilhoAtivo = item.children!.some((c) => c.active);
  const [aberto, setAberto] = useState(item.active || temFilhoAtivo);

  return (
    <div>
      <div className={cn(LINHA, "pr-2", item.active && !temFilhoAtivo ? ATIVO : INATIVO)}>
        <a href={item.href} aria-current={item.active ? "page" : undefined} data-tour={item.dataTour}
          className="ds-focus flex min-w-0 flex-1 items-center gap-3">
          {item.icon && <span className={item.active || temFilhoAtivo ? "text-[color:var(--brand-light)]" : "text-white/45"}>{item.icon}</span>}
          <span className="truncate">{item.label}</span>
        </a>
        <button type="button" onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto} aria-label={`${aberto ? "Fechar" : "Abrir"} ${item.label}`}
          className="ds-focus rounded p-1 text-white/45 hover:text-white">
          <Chevron aberto={aberto} />
        </button>
      </div>

      {aberto && (
        <div className="pb-1">
          {item.children!.map((c) => (
            <a key={c.href} href={c.href} aria-current={c.active ? "page" : undefined}
              className={cn(
                "ds-focus flex items-center gap-2 border-l-[3px] py-2 pl-[52px] pr-5 font-montserrat text-[13px] transition-colors",
                c.active
                  ? "border-l-[color:var(--brand-light)] bg-[rgba(0,180,216,.10)] font-semibold text-white"
                  : "border-l-transparent text-white/50 hover:bg-white/[.05] hover:text-white/90")}>
              <span className="truncate">{c.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ groups, brand, footer }: { groups: NavGroup[]; brand?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col" style={{ background: "var(--ink)" }}>
      {/* Só aparece abaixo de 1024px: no desktop a marca está na barra superior. */}
      {brand && <div className="border-b border-white/10 px-5 py-4 lg:hidden">{brand}</div>}
      <nav className="flex-1 overflow-y-auto py-4" aria-label="Navegação">
        {groups.map((g, gi) => (
          <div key={gi} className="mb-1">
            {g.title && <p className="px-5 pb-2 pt-3 font-jbmono text-[11px] uppercase tracking-[0.14em] text-white/40">{g.title}</p>}
            {g.items.map((it) => (
              it.children?.length
                ? <ItemComFilhos key={it.href} item={it} />
                : (
                  <a key={it.href} href={it.href} aria-current={it.active ? "page" : undefined} data-tour={it.dataTour}
                    className={cn(LINHA, it.active ? ATIVO : INATIVO)}>
                    {it.icon && <span className={it.active ? "text-[color:var(--brand-light)]" : "text-white/45"}>{it.icon}</span>}
                    <span className="truncate">{it.label}</span>
                  </a>
                )
            ))}
          </div>
        ))}
      </nav>
      {footer && <div className="border-t border-white/10 p-3">{footer}</div>}
    </div>
  );
}

export function AppShell({ sidebar, brand, topbarRight, children }: {
  sidebar: React.ReactNode; brand?: React.ReactNode; topbarRight?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds min-h-screen bg-[var(--bg-2)]">
      <header className="fixed inset-x-0 top-0 z-[300] flex h-[60px] items-center gap-3 px-4 sm:px-5"
        style={{ background: "var(--ink)", borderBottom: "3px solid var(--brand-light)" }}>
        <button onClick={() => setOpen((v) => !v)} aria-label="Abrir menu" className="ds-focus text-white/70 lg:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        {brand}
        <div className="ml-auto flex items-center gap-2">{topbarRight}</div>
      </header>

      {open && <div className="fixed inset-0 z-[290] bg-ink/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside onClick={() => setOpen(false)}
        className={cn("fixed bottom-0 left-0 top-[60px] z-[295] w-[260px] overflow-y-auto transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        {sidebar}
      </aside>

      <main className="min-w-0 pt-[60px] lg:ml-[260px]">{children}</main>
    </div>
  );
}

/** NavBar sticky com glass leve (único lugar com glassmorphism). */
export function NavBar({ left, right, className }: { left?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("ds sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline px-6", className)}
      style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)" }}>
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

/**
 * Área de conteúdo — largura cheia com respiro de 32px, como `.acad-main { padding: 32px }`.
 * O v5 tinha teto de 1160px; a Academy não tem, e em tela larga isso é o que faz as grades
 * abrirem em 5 colunas em vez de 3. `--container` segue existindo para quem quiser limitar.
 */
export function ContentArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full min-w-0 px-5 py-6 sm:px-8 sm:py-8", className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, subtitle, actions, configurar, comoUsar, className }: {
  eyebrow?: string; title: string; subtitle?: string;
  actions?: React.ReactNode; configurar?: React.ReactNode; comoUsar?: React.ReactNode; className?: string;
}) {
  return (
    <header className={cn("mb-7 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="ds-h1 mt-2">{title}</h1>
        {subtitle && <p className="ds-lead mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {(actions || configurar || comoUsar) && (
        <div className="flex items-center gap-2">{comoUsar}{configurar}{actions}</div>
      )}
    </header>
  );
}
