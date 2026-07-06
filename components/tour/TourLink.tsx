"use client";
/** Link "Fazer o tour" — reabre o tour da superfície a qualquer momento (ignora o estado). */
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";

export function TourLink({ entryPath, className, label = "Fazer o tour" }: { entryPath: string; className?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`${entryPath}?tour=1`)}
      className={className ?? "ds-focus flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-hairline-strong px-3 py-2 font-montserrat text-[13px] font-medium text-[color:var(--fg-2)] transition-colors hover:bg-[var(--bg-2)]"}
    >
      <Icon name="rocket" size={14} /> {label}
    </button>
  );
}
