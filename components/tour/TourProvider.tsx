"use client";
/**
 * Tour guiado (R5.4) — motor driver.js tematizado ao v2.
 * • Auto-abre no 1º acesso da superfície (quando `autoStart` e estamos na entryPath).
 * • Reabre por link: navegação para `?tour=1` (ignora estado).
 * • Fechar/pular/concluir → marca visto (nunca reabre sozinho).
 * • Passo interativo (`route`) inicia a ação real e encerra o tour.
 * a11y: teclado (←/→/Esc) e foco no popover pelo próprio driver.js; reduced-motion respeitado.
 */
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "@/styles/tour.css";
import { markTourSeen } from "@/lib/tour/actions";
import type { Surface, TourStep } from "@/lib/tour/types";
import { ADMIN_STEPS } from "@/lib/tour/steps.admin";
import { PORTAL_STEPS } from "@/lib/tour/steps.portal";

const STEPS: Record<Surface, TourStep[]> = { admin: ADMIN_STEPS, portal: PORTAL_STEPS };

export function TourProvider({ surface, entryPath, autoStart }: { surface: Surface; entryPath: string; autoStart: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const runningRef = useRef(false);

  useEffect(() => {
    const wantsReopen = params.get("tour") === "1";
    const wantsAuto = autoStart && pathname === entryPath;
    if (!wantsReopen && !wantsAuto) return;
    if (runningRef.current) return;
    runningRef.current = true;

    // limpa ?tour=1 para que um refresh não reabra
    if (wantsReopen && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState({}, "", url.toString());
    }

    const steps = STEPS[surface];
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let navigated = false;
    let closedViaX = false;

    const d: Driver = driver({
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Próximo",
      prevBtnText: "Voltar",
      doneBtnText: "Concluir",
      overlayColor: "rgba(11, 12, 30, 0.62)",
      stagePadding: 6,
      stageRadius: 12,
      popoverClass: "st-tour",
      animate: !reduced,
      smoothScroll: true,
      allowClose: true,
      allowKeyboardControl: true,
      steps: steps.map((s) => ({
        element: s.target,
        popover: {
          title: s.titulo,
          description: s.corpo,
          side: s.side,
          align: s.align,
          ...(s.route ? { nextBtnText: s.ctaText ?? "Começar", doneBtnText: s.ctaText ?? "Começar" } : {}),
        },
      })),
      onNextClick: () => {
        const i = d.getActiveIndex() ?? 0;
        const cur = steps[i];
        if (cur?.route) { launch(cur.route); return; }
        d.moveNext();
      },
      onCloseClick: () => { closedViaX = true; seenAndDestroy(); },
      onDestroyStarted: () => {
        if (navigated) { d.destroy(); return; }
        const i = d.getActiveIndex() ?? -1;
        const cur = steps[i];
        // No último passo (CTA) o "Concluir" leva à ação real — a menos que tenha sido o X (pular).
        if (cur?.route && i === steps.length - 1 && !closedViaX) { launch(cur.route); return; }
        seenAndDestroy();
      },
      onDestroyed: () => { runningRef.current = false; },
    });

    function launch(route: string) {
      if (navigated) return;
      navigated = true;
      void markTourSeen(surface);
      d.destroy();
      router.push(route);
    }
    function seenAndDestroy() {
      void markTourSeen(surface);
      d.destroy();
    }

    // pequeno atraso para garantir que os alvos estão montados
    const t = setTimeout(() => d.drive(), 350);
    return () => { clearTimeout(t); if (d.isActive()) d.destroy(); runningRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, params, autoStart, surface, entryPath]);

  return null;
}
