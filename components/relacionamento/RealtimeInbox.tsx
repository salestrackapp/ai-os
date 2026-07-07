"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncInboxAction } from "@/app/admin/relacionamento/actions";

/**
 * Mantém a caixa em tempo real SEM travar a navegação: a sincronização do Gmail roda em
 * background (server action que revalida), e a tela dá refresh periódico. Só com a aba visível.
 */
export function RealtimeInbox({ syncEmail, seconds = 25 }: { syncEmail: boolean; seconds?: number }) {
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
        if (syncEmail) await syncInboxAction();   // sincroniza Gmail + revalidatePath (atualiza a lista)
        else ref.current.refresh();               // WhatsApp chega por webhook: só atualiza a tela
      } catch { /* nunca quebra a navegação */ }
      finally { if (alive) busy.current = false; }
    };
    const first = setTimeout(tick, 500);          // 1ª sync logo após abrir (não bloqueia o render)
    const id = setInterval(tick, Math.max(10, seconds) * 1000);
    return () => { alive = false; clearTimeout(first); clearInterval(id); };
  }, [syncEmail, seconds]);

  return null;
}
