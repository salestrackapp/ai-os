import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { googleConfigured } from "@/lib/google";
import { CHANNEL_LABELS, OUTREACH_STATUS_LABELS, type OutreachMessage } from "@/lib/prospecting/types";
import { approveAndSend, saveDraft, rejectDraft, processCadencesNow } from "../ops";

export const dynamic = "force-dynamic";

export default async function AprovacaoPage() {
  const supabase = await createClient();
  const { data: msgs } = await supabase.from("outreach_messages").select("*").in("status", ["rascunho", "aprovada"]).order("created_at", { ascending: false }).limit(100);
  const list = (msgs as OutreachMessage[]) ?? [];
  const pIds = [...new Set(list.map((m) => m.prospect_id))];
  const { data: ps } = pIds.length ? await supabase.from("prospects").select("id, name, email, title").in("id", pIds) : { data: [] as { id: string; name: string; email: string | null; title: string | null }[] };
  const pById: Record<string, { name: string; email: string | null; title: string | null }> = Object.fromEntries((ps ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Link href="/admin/prospeccao" className="text-sm text-muted2 hover:text-gold">← Central</Link>
          <h1 className="font-serif text-4xl font-semibold mt-1">Fila de aprovação</h1>
          <p className="text-sm text-muted mt-1">Portão humano: nenhuma mensagem fria sai sem sua revisão e aprovação.</p>
        </div>
        <form action={processCadencesNow}><button className="btn-ghost text-sm">Processar cadências agora</button></form>
      </div>

      {!googleConfigured() && <div className="card p-3 mb-4 border-goldline bg-[rgba(79, 31, 255,.06)]"><p className="text-sm text-gold">Sem GOOGLE_OAUTH: aprovar e-mail marca como <b>aprovada</b> para envio manual (o Gmail não dispara automaticamente).</p></div>}

      <div className="space-y-4">
        {list.map((m) => {
          const p = pById[m.prospect_id];
          return (
            <div key={m.id} className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/prospeccao/${m.prospect_id}`} className="font-serif text-lg font-semibold hover:text-gold">{p?.name ?? "—"}</Link>
                  <span className="badge-muted">{CHANNEL_LABELS[m.channel] ?? m.channel}</span>
                  <span className="badge-muted">{m.variant ?? ""}</span>
                  <span className={m.status === "aprovada" ? "badge-gold" : "badge-muted"}>{OUTREACH_STATUS_LABELS[m.status] ?? m.status}</span>
                </div>
                <span className="text-[11px] text-muted2">{p?.email ?? ""}</span>
              </div>
              <form action={saveDraft.bind(null, m.id)} className="space-y-2">
                {m.channel === "email" && <input name="subject" defaultValue={m.subject ?? ""} className="input w-full text-sm" placeholder="Assunto" />}
                <textarea name="body" defaultValue={m.body ?? ""} rows={5} className="input w-full text-sm" />
                <button className="btn-ghost text-xs">Salvar edição</button>
              </form>
              <div className="flex items-center gap-2 mt-2">
                <form action={approveAndSend.bind(null, m.id)}><button className="btn-gold text-xs">Aprovar & enviar</button></form>
                <form action={rejectDraft.bind(null, m.id)}><button className="text-red-400/70 hover:text-red-400 text-xs">Reprovar</button></form>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="card p-8"><p className="text-sm text-muted2">Nenhum rascunho pendente. Gere toques na ficha de um prospect ou deixe a cadência rodar.</p></div>}
      </div>
    </div>
  );
}
