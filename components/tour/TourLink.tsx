"use client";
/** Botão "Fazer o tour" — reabre o tour da superfície a qualquer momento (ignora o estado "visto"). */
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { tourEvent, tourFlag } from "./TourProvider";
import type { Surface } from "@/lib/tour/types";

export function TourLink({ surface, entryPath, className, label = "Fazer o tour" }: {
  surface: Surface; entryPath: string; className?: string; label?: string;
}) {
  const router = useRouter();
  function onClick() {
    // Já na entryPath (onde vivem os alvos): dispara o tour direto.
    // Em outra página: deixa uma flag e navega — o provider inicia ao chegar.
    if (typeof window !== "undefined" && window.location.pathname === entryPath) {
      window.dispatchEvent(new CustomEvent(tourEvent(surface)));
      return;
    }
    try { sessionStorage.setItem(tourFlag(surface), "1"); } catch { /* ignora */ }
    router.push(entryPath);
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={className ?? "ds-focus flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-hairline-strong px-3 py-2 font-montserrat text-[14px] font-medium text-[color:var(--fg-2)] transition-colors hover:bg-[var(--bg-2)]"}
    >
      <Icon name="rocket" size={14} /> {label}
    </button>
  );
}
