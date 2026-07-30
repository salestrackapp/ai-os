"use client";
/**
 * Tour guiado (R5.4) — motor driver.js tematizado ao v2.
 * • Auto-abre no 1º acesso da superfície (quando `autoStart` e estamos na entryPath).
 * • Reabre pelo botão "Fazer o tour": mesma página → evento; outra página → flag + navega à entryPath.
 *   (Não usa `?tour=1`: no Next 15 o history.replaceState sincroniza com useSearchParams e
 *   re-renderizava o provider, cancelando o start do tour — por isso o botão "não funcionava".)
 * • Fechar/pular/concluir → marca visto (nunca reabre sozinho).
 * • Passo interativo (`route`) inicia a ação real e encerra o tour.
 * a11y: teclado (←/→/Esc) e foco no popover pelo próprio driver.js; reduced-motion respeitado.
 */
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "@/styles/tour.css";
import { markTourSeen } from "@/lib/tour/actions";
import type { Surface, TourStep } from "@/lib/tour/types";
import { ADMIN_STEPS } from "@/lib/tour/steps.admin";
import { PORTAL_STEPS } from "@/lib/tour/steps.portal";

const STEPS: Record<Surface, TourStep[]> = { admin: ADMIN_STEPS, portal: PORTAL_STEPS };
export const tourEvent = (s: Surface) => `aios:tour:${s}`;
export const tourFlag = (s: Surface) => `aios_tour_${s}`;

export function TourProvider({ surface, entryPath, autoStart }: { surface: Surface; entryPath: string; autoStart: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const runningRef = useRef(false);

  useEffect(() => {
    // Os alvos do tour só existem na entryPath (cockpit Hoje / Minha Jornada).
    if (pathname !== entryPath) return;

    // Deve iniciar agora? Auto no 1º acesso, ou flag deixada por navegação vinda do botão.
    let shouldStart = autoStart;
    try {
      if (typeof window !== "undefined" && sessionStorage.getItem(tourFlag(surface)) === "1") {
        shouldStart = true;
        sessionStorage.removeItem(tourFlag(surface));
      }
    } catch { /* sessionStorage indisponível — segue só com autoStart */ }

    let d: Driver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function start() {
      if (runningRef.current) return;
      runningRef.current = true;

      const steps = STEPS[surface];
      const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let navigated = false;
      let closedViaX = false;

      const drv: Driver = driver({
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
        smoothScroll: false,
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
          const i = drv.getActiveIndex() ?? 0;
          const cur = steps[i];
          if (cur?.route) { launch(cur.route); return; }
          drv.moveNext();
        },
        onCloseClick: () => { closedViaX = true; seenAndDestroy(); },
        onDestroyStarted: () => {
          if (navigated) { drv.destroy(); return; }
          const i = drv.getActiveIndex() ?? -1;
          const cur = steps[i];
          // No último passo (CTA) o "Concluir" leva à ação real — a menos que tenha sido o X (pular).
          if (cur?.route && i === steps.length - 1 && !closedViaX) { launch(cur.route); return; }
          seenAndDestroy();
        },
        onDestroyed: () => { runningRef.current = false; },
      });
      d = drv;

      function launch(route: string) {
        if (navigated) return;
        navigated = true;
        void markTourSeen(surface);
        drv.destroy();
        router.push(route);
      }
      function seenAndDestroy() {
        void markTourSeen(surface);
        drv.destroy();
      }

      // pequeno atraso para garantir que os alvos estão montados
      timer = setTimeout(() => drv.drive(), 120);
    }

    if (shouldStart) start();

    const onEvt = () => start();
    window.addEventListener(tourEvent(surface), onEvt);
    return () => {
      window.removeEventListener(tourEvent(surface), onEvt);
      if (timer) clearTimeout(timer);
      if (d && d.isActive()) d.destroy();
      runningRef.current = false;
    };
  }, [pathname, entryPath, surface, autoStart, router]);

  return null;
}
