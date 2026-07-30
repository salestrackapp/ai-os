"use client";
/**
 * Sino de notificações. Assina a tabela via Realtime em vez de consultar de tempos em tempos —
 * a versão de origem no crm-premium fazia polling a cada 30s, o que gera requisição constante
 * e ainda assim atrasa o aviso em até meio minuto.
 *
 * A RLS já limita as linhas ao próprio usuário, então o cliente do navegador basta.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icons";

type Notif = { id: string; title: string; body: string | null; url: string | null; read: boolean; created_at: string };

export function NotificationBell({ userId }: { userId: string }) {
  // Vive na barra superior navy: botão discreto sobre escuro e painel que abre para baixo.
  const [itens, setItens] = useState<Notif[]>([]);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = createClient();
    let vivo = true;

    (async () => {
      const { data } = await sb.from("notifications")
        .select("id, title, body, url, read, created_at")
        .order("created_at", { ascending: false }).limit(20);
      if (vivo) setItens(data ?? []);
    })();

    const canal = sb.channel(`notif:${userId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => setItens((prev) => [payload.new as Notif, ...prev].slice(0, 20)))
      .subscribe();

    return () => { vivo = false; sb.removeChannel(canal); };
  }, [userId]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const naoLidas = itens.filter((n) => !n.read).length;

  async function marcarTodasLidas() {
    const ids = itens.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setItens((prev) => prev.map((n) => ({ ...n, read: true })));
    const sb = createClient();
    const { error } = await sb.from("notifications")
      .update({ read: true, read_at: new Date().toISOString() }).in("id", ids);
    if (error) console.warn("[sino] não consegui marcar como lidas:", error.message);
  }

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={naoLidas ? `Notificações (${naoLidas} não lidas)` : "Notificações"}
        className="ds-focus flex items-center gap-1.5 rounded-[10px] border border-white/15 px-3 py-1.5 font-montserrat text-[14px] font-medium text-white/75 transition-colors hover:bg-white/10"
      >
        <Icon name="activity" size={14} /> <span className="hidden sm:inline">Notificações</span>
        {naoLidas > 0 && (
          <span className="ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--brand-light)] px-1.5 text-ink font-jbmono text-[11px] font-semibold">
            {naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[320px] max-h-[420px] overflow-y-auto rounded-[12px] border border-hairline-strong bg-[var(--bg-1)] shadow-lg">
          <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
            <span className="font-montserrat text-[13px] font-semibold text-[color:var(--fg-1)]">Notificações</span>
            {naoLidas > 0 && (
              <button onClick={marcarTodasLidas} className="ds-focus font-montserrat text-[13px] text-[color:var(--fg-3)] hover:text-[color:var(--fg-1)]">
                Marcar todas como lidas
              </button>
            )}
          </div>
          {itens.length === 0 ? (
            <p className="px-3 py-6 text-center font-montserrat text-[13px] text-[color:var(--fg-3)]">Nada por aqui ainda.</p>
          ) : (
            <ul>
              {itens.map((n) => {
                const conteudo = (
                  <>
                    <span className="block font-montserrat text-[13px] font-medium text-[color:var(--fg-1)]">{n.title}</span>
                    {n.body && <span className="mt-0.5 block font-montserrat text-[13px] text-[color:var(--fg-3)]">{n.body}</span>}
                  </>
                );
                return (
                  <li key={n.id} className={`border-b border-hairline px-3 py-2.5 ${n.read ? "" : "bg-[var(--bg-2)]"}`}>
                    {n.url ? <Link href={n.url} onClick={() => setAberto(false)} className="ds-focus block">{conteudo}</Link> : conteudo}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
