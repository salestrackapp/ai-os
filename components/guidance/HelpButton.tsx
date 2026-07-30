"use client";
/**
 * "Como usar" — abre um Drawer com ajuda curta e específica da tela (registro em lib/guidance).
 * Se a rota não tem entrada, não renderiza nada (nunca mostra ajuda vazia).
 */
import { useState } from "react";
import { Drawer } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { helpFor } from "@/lib/guidance/registry";

export function HelpButton({ routeKey }: { routeKey: string }) {
  const help = helpFor(routeKey);
  const [open, setOpen] = useState(false);
  if (!help) return null;
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="ds-focus inline-flex h-10 items-center gap-1.5 rounded-ds-input border border-hairline px-3 font-montserrat text-[14px] font-medium text-[color:var(--fg-2)] transition-colors hover:bg-[var(--bg-2)]">
        <Icon name="book" size={15} /> Como usar
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={`Como usar · ${help.titulo}`}>
        <div className="space-y-5">
          <p className="ds-lead text-[color:var(--fg-2)]">{help.oQueE}</p>
          <div>
            <p className="ds-eyebrow mb-3">Passo a passo</p>
            <ol className="space-y-3">
              {help.passos.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tile)] font-jbmono text-[13px] font-medium text-[color:var(--brand-deep)]">{i + 1}</span>
                  <span className="font-montserrat text-[14px] leading-snug text-[color:var(--fg-1)]">{p}</span>
                </li>
              ))}
            </ol>
          </div>
          {help.dica && (
            <div className="rounded-ds-input border border-hairline bg-[var(--bg-2)] p-3.5">
              <p className="ds-eyebrow mb-1.5">Dica</p>
              <p className="font-montserrat text-[14px] leading-snug text-[color:var(--fg-2)]">{help.dica}</p>
            </div>
          )}
          <a href={routeKey.startsWith("/portal") ? "/portal/ajuda" : "/admin/ajuda"}
            className="inline-flex items-center gap-1.5 font-montserrat text-[14px] font-medium text-[color:var(--brand)] hover:underline">
            <Icon name="book" size={14} /> Ver todos os guias
          </a>
        </div>
      </Drawer>
    </>
  );
}
