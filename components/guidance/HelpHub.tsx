"use client";
/** Central de ajuda buscável (R5.1) — deriva do registro de guias. Tom copiloto, sem jargão. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { searchGuides } from "@/lib/guidance/registry";
import { Icon } from "@/components/ui/icons";
import { TourLink } from "@/components/tour/TourLink";
import { botaoClasses } from "@/components/ds";

export function HelpHub({ surface }: { surface: "admin" | "portal" }) {
  const [q, setQ] = useState("");
  const guides = useMemo(() => searchGuides(q, surface), [q, surface]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-ds-card border border-hairline bg-[var(--tile)] p-4">
        <p className="font-montserrat text-[13.5px] text-[color:var(--brand-deep)]">Prefere um passo a passo guiado? Faça o tour da tela — leva 1 minuto.</p>
        <TourLink surface={surface} entryPath={surface === "admin" ? "/admin/hoje" : "/portal"} className={botaoClasses()} />
      </div>
      <div className="relative mb-6 max-w-xl">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--fg-4)]"><Icon name="target" size={16} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar um guia" placeholder="Buscar um guia (ex.: proposta, régua, entregável, resultados)…"
          className="ds-focus h-11 w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] pl-10 pr-3 font-montserrat text-sm text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
      </div>

      {guides.length === 0 ? (
        <p className="ds-small">Nenhum guia encontrado para “{q}”. Tente outra palavra.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {guides.map((g) => (
            <Link key={g.href} href={g.href} className="group rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4 shadow-ds-xs transition-colors hover:border-[color:var(--brand-light)]">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--tile)] text-[color:var(--brand)]"><Icon name="book" size={15} /></span>
                <p className="font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">{g.help.titulo}</p>
              </div>
              <p className="ds-small !mt-0 mb-2">{g.help.oQueE}</p>
              <ul className="space-y-1">
                {g.help.passos.slice(0, 3).map((p, i) => (
                  <li key={i} className="flex gap-2 font-montserrat text-[13px] text-[color:var(--fg-3)]"><span className="font-jbmono text-[color:var(--brand)]">{i + 1}</span> {p}</li>
                ))}
              </ul>
              <p className="mt-2.5 inline-flex items-center gap-1 font-montserrat text-[13px] font-medium text-[color:var(--brand)] group-hover:underline">Abrir a tela →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
