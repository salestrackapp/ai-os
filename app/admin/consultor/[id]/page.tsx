import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postAdminReply } from "../actions";

export const dynamic = "force-dynamic";
const CANAL_LABEL: Record<string, string> = { portal: "Portal", whatsapp: "WhatsApp", slack: "Slack" };

export default async function ConversaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: conv } = await supabase.from("conversations").select("*").eq("id", id).single();
  if (!conv) notFound();
  const [{ data: org }, { data: msgs }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", conv.org_id).single(),
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at"),
  ]);
  const messages = (msgs ?? []) as { id: string; role: string; content: string; autor: string | null; created_at: string }[];

  return (
    <div className="max-w-3xl">
      <Link href="/admin/consultor" className="text-sm text-muted2 hover:text-gold">← Conversas</Link>
      <div className="flex items-center gap-2 mt-2 mb-5">
        <h1 className="font-serif text-3xl font-semibold">{org?.name ?? "—"}</h1>
        <span className="badge-muted">{CANAL_LABEL[conv.canal] ?? conv.canal}</span>
      </div>

      <div className="card p-6 space-y-3 mb-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-gold text-white font-medium" : "bg-navy3 border border-line text-cream"}`}>
              {m.content}
              <span className="block text-[10px] mt-1 opacity-60">{m.role === "user" ? "Cliente" : m.autor === "humano" ? "Salestrack (humano)" : "Consultor (IA)"} · {new Date(m.created_at).toLocaleString("pt-BR")}</span>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-sm text-muted2">Sem mensagens.</p>}
      </div>

      <form action={postAdminReply.bind(null, id)} className="card p-4">
        <label className="label mb-1 block">Responder como Salestrack (assume a conversa)</label>
        <textarea name="content" rows={3} className="input w-full text-sm" placeholder="Sua resposta ao cliente…" required />
        <p className="text-[11px] text-muted2 mt-1">A mensagem é marcada como humana. No WhatsApp/Slack, é entregue ao cliente quando o canal está configurado.</p>
        <button className="btn-gold text-sm mt-2">Enviar resposta</button>
      </form>
    </div>
  );
}
