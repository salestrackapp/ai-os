"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantém a tela em tempo real: chama router.refresh() a cada N segundos (revalida o Server Component),
 * só quando a aba está visível. Sem recarregar a página inteira.
 */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  const ref = useRef(router);
  ref.current = router;
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") ref.current.refresh(); }, Math.max(8, seconds) * 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return null;
}
