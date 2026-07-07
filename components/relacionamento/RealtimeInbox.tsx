"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncInboxAction, reconcileWhatsAppAction } from "@/app/admin/relacionamento/actions";

/**
 * Mantém a caixa em tempo real SEM travar a navegação: sincroniza Gmail e reconcilia o WhatsApp
 * em background (server actions que revalidam) e dá refresh periódico. Só com a aba visível.
 */
export function RealtimeInbox({ syncEmail, syncWa, seconds = 25 }: { syncEmail: boolean; syncWa: boolean; seconds?: number }) {
  const router = useRouter();
  const ref = useRef(router);
  ref.current = router;
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible" || busy.current) return;
      busy.current = true;
      try {
        if (syncEmail) await syncInboxAction();       // Gmail → inbox + revalidate
        if (syncWa) await reconcileWhatsAppAction();   // WhatsApp: auto-cura conteúdo do webhook + revalidate
        if (!syncEmail && !syncWa) ref.current.refresh();
      } catch { /* nunca quebra a navegação */ }
      finally { if (alive) busy.current = false; }
    };
    const first = setTimeout(tick, 500);
    const id = setInterval(tick, Math.max(10, seconds) * 1000);
    return () => { alive = false; clearTimeout(first); clearInterval(id); };
  }, [syncEmail, syncWa, seconds]);

  return null;
}
