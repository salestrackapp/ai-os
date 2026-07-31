import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readTimeline } from "@/lib/prospecting/timeline";
import { AiAssist } from "@/components/AiAssist";
import { canEnroll } from "@/lib/prospecting/score";
import { simularCadencia } from "@/lib/prospecting/simulacao";
import { googleConfigured } from "@/lib/google";
import { ICP_LABELS, PROSPECT_STATUS_LABELS, type Prospect, type ProspectAccount, type Cadence } from "@/lib/prospecting/types";
import { runDossier, runOutreach, enrollInCadence, ingestTimeline, registerResponse, convertToDeal, markNurture } from "../ops";
import { generateAction } from "@/app/admin/entregaveis/actions";
import { Icon } from "@/components/ui/icons";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const SRC = { gmail: "📧 Gmail", calendar: "📅 Calendar", readai: "🎙 Read AI", cadence: "📤 Cadência", manual: "✍️ Manual" } as Record<string, string>;

export default async function ProspectFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("prospects").select("*").eq("id", id).single();
  if (!p) notFound();
  const prospect = p as Prospect;
  const [{ data: acc }, { data: cadences }, timeline, { data: enrollments }] = await Promise.all([
    prospect.account_id ? supabase.from("prospect_accounts").select("*").eq("id", prospect.account_id).single() : Promise.resolve({ data: null }),
    supabase.from("cadences").select("*").eq("is_active", true).order("name"),
    readTimeline("prospect", id),
    supabase.from("cadence_enrollments").select("*").eq("prospect_id", id).order("enrolled_at", { ascending: false }),
  ]);
  const account = acc as ProspectAccount | null;
  const cadList = (cadences as Cadence[]) ?? [];
  const gate = canEnroll(prospect);
  const signals = Array.isArray(account?.signals) ? (account!.signals as string[]) : [];

  /**
   * O que a cadência FARIA — calculado antes de qualquer clique, para a primeira cadência do ICP
   * do prospect. Não escreve nada; só mostra o calendário e onde ele esbarra em canal desligado.
   */
  const cadenciaSugerida = cadList.find((c) => c.icp === prospect.icp) ?? cadList[0] ?? null;
  const previa = gate.ok && cadenciaSugerida ? await simularCadencia(id, cadenciaSugerida.id) : null;

  return (
    <ContentArea>
      <div>
        <Link href="/admin/prospeccao" className="text-sm text-muted2 hover:text-gold">← Central de Prospecção</Link>
        <div className="flex items-center gap-3 mt-2 mb-1 flex-wrap">
          <h1 className="font-serif text-3xl font-semibold">{prospect.name}</h1>
          <span className={gate.ok ? "badge-teal" : "badge-muted"} title={`mínimo ICP ${gate.min}`}>score {prospect.score}{gate.ok ? "" : ` / ${gate.min}`}</span>
          <span className="badge-muted">{PROSPECT_STATUS_LABELS[prospect.status] ?? prospect.status}</span>
          {prospect.deal_id && <Link href={`/admin/crm/${prospect.deal_id}`} className="badge-gold">ver deal →</Link>}
        </div>
        <p className="text-sm text-muted mb-6">{prospect.title} · {account?.name ?? "—"} · {prospect.icp ? ICP_LABELS[prospect.icp] : "ICP não definido"}</p>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Dossiê */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap"><h2 className="font-serif text-lg font-semibold">Dossiê (Inteligência)</h2>
                <div className="flex items-center gap-2">
                  <form action={runDossier.bind(null, id)}><button className="btn-ghost text-xs">{prospect.dossier_md ? "Regerar" : "Gerar dossiê"}</button></form>
                  {prospect.dossier_md && <form action={generateAction.bind(null, "dossie", id)}><button className="btn-ghost text-xs">Dossiê executivo →</button></form>}
                </div>
              </div>
              {prospect.dossier_md ? <div className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{prospect.dossier_md}</div> : <p className="text-sm text-muted2">Sem dossiê. Gere com o agente de Inteligência.</p>}
            </div>

            {/* Timeline */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3"><h2 className="font-serif text-lg font-semibold">Timeline</h2>
                <form action={ingestTimeline.bind(null, id)}><button className="btn-ghost text-xs" title={(await googleConfigured()) ? "" : "Sem GOOGLE_OAUTH — Gmail/Calendar inativos"}>Sincronizar Gmail/Calendar</button></form>
              </div>
              {timeline.length === 0 ? <p className="text-sm text-muted2">Sem eventos. {(await googleConfigured()) ? "Sincronize acima." : "Gmail/Calendar em modo manual (sem env)."}</p> : (
                <ul className="space-y-2">
                  {timeline.map((e) => (
                    <li key={e.id} className="flex gap-3 text-sm border-b border-line last:border-0 pb-2">
                      <span className="text-[13px] text-muted2 w-24 shrink-0">{e.occurred_at ? new Date(e.occurred_at).toLocaleDateString("pt-BR") : ""}</span>
                      <span className="text-muted2 w-24 shrink-0">{SRC[e.source] ?? e.source}</span>
                      <span className="text-cream flex-1">{e.summary}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Copiloto do prospect (resumo da timeline) */}
            <AiAssist context={[
              `Prospect: ${prospect.name}${prospect.title ? `, ${prospect.title}` : ""} · ${account?.name ?? "—"} · ${prospect.icp ? ICP_LABELS[prospect.icp] : "ICP n/d"}`,
              prospect.dossier_md ? `Dossiê:\n${prospect.dossier_md.slice(0, 1500)}` : "",
              timeline.length ? `Timeline (e-mails/reuniões/toques):\n${timeline.map((e) => `- ${e.occurred_at ? new Date(e.occurred_at).toLocaleDateString("pt-BR") : ""} ${e.source}/${e.kind}: ${e.summary ?? ""}`).join("\n")}` : "Timeline vazia.",
            ].filter(Boolean).join("\n")} title="Copiloto do prospect" actions={[
              { label: "Resumir a timeline", task: "Resuma o histórico de contato (e-mails, reuniões, toques) em bullets: o que aconteceu, temperatura da relação e o que ficou pendente." },
              { label: "Status da relação", task: "Diga em 2-3 frases a temperatura atual desta relação e o nível de interesse percebido, com base no histórico." },
              { label: "Próximo passo", task: "Recomende o próximo passo concreto com este prospect, coerente com o histórico e a doutrina (dor primeiro, sem pitch cedo)." },
            ]} />

            {/* Registrar resposta */}
            <div className="card p-6">
              <h2 className="font-serif text-lg font-semibold mb-3">Registrar resposta recebida</h2>
              <form action={registerResponse.bind(null, id)} className="space-y-2">
                <textarea name="response" rows={2} className="input w-full text-sm" placeholder="Cole a resposta do prospect — o agente classifica e pausa a cadência." required />
                <button className="btn-ghost text-xs">Classificar & pausar cadência</button>
              </form>
            </div>
          </div>

          {/* Ações */}
          <div className="space-y-5">
            <div className="card p-6">
              <h3 className="font-serif text-lg font-semibold mb-3">Abordagem (Redação)</h3>
              <div className="space-y-2">
                <form action={runOutreach.bind(null, id, false, "email")}><button className="btn-gold w-full justify-center text-sm">Gerar toque frio (e-mail)</button></form>
                <form action={runOutreach.bind(null, id, true, "email")}><button className="btn-ghost w-full justify-center text-sm">Gerar toque warm (e-mail)</button></form>
                <form action={runOutreach.bind(null, id, false, "whatsapp")}><button className="btn-ghost w-full justify-center text-sm">Gerar toque (WhatsApp)</button></form>
              </div>
              <p className="text-[13px] text-muted2 mt-2">Toques entram como rascunho na fila de aprovação — nada é enviado sem sua revisão.</p>
            </div>

            <div className="card p-6">
              <h3 className="font-serif text-lg font-semibold mb-3">Cadência</h3>
              {!gate.ok ? (
                <p className="text-sm text-muted2"><Icon name="lock" size={13} className="inline -mt-0.5" /> Score {prospect.score} abaixo do mínimo do ICP (<b className="text-cream">{gate.min}</b>). Prospecção é por <b>sinal, não volume</b> — enriqueça sinais/cargo para qualificar.</p>
              ) : (
                <>
                  {/* O que vai acontecer, antes de acontecer. Ver §simulacao.ts: nada aqui escreve. */}
                  {previa && (
                    <div className="mb-3 rounded-ds-card border border-hairline bg-[var(--bg-2)] p-3">
                      <p className="text-[13px] font-semibold text-cream">Se inscrever agora, em <b>{previa.cadencia}</b>:</p>
                      <ul className="mt-2 space-y-1.5">
                        {previa.passos.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug">
                            <span className="w-24 shrink-0 text-muted2">{s.quando}</span>
                            <span className="w-20 shrink-0 text-cream">{s.canal}</span>
                            <span className={s.desfecho === "rascunho_para_aprovar" ? "text-cream" : "text-muted2"}>{s.explicacao}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[12px] text-muted2">
                        {previa.manuais === 0
                          ? "Todos os toques chegam prontos na fila para você aprovar."
                          : <>Dos {previa.passos.length} passos, <b className="text-cream">{previa.manuais}</b> viram trabalho manual seu. <b>Nenhuma mensagem sai sem sua aprovação.</b></>}
                      </p>
                    </div>
                  )}
                  <form action={enrollInCadence.bind(null, id)} className="space-y-2">
                    <select name="cadence_id" defaultValue={cadenciaSugerida?.id ?? ""} className="input w-full text-sm" required><option value="">Escolha a cadência…</option>{cadList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <button className="btn-gold w-full justify-center text-sm">Inscrever na cadência</button>
                  </form>
                </>
              )}
              {(enrollments ?? []).length > 0 && (
                <div className="mt-3 space-y-1">
                  {(enrollments ?? []).map((e) => <p key={e.id} className="text-[13px] text-muted2">Passo {e.current_step} · {e.status}{e.next_action_at ? ` · próximo ${new Date(e.next_action_at).toLocaleDateString("pt-BR")}` : ""}</p>)}
                </div>
              )}
            </div>

            <div className="card p-6 space-y-2">
              <h3 className="font-serif text-lg font-semibold mb-1">Ações</h3>
              {!prospect.deal_id && <form action={convertToDeal.bind(null, id)}><button className="btn-gold w-full justify-center text-sm">Converter em deal</button></form>}
              <form action={markNurture.bind(null, id)}><button className="btn-ghost w-full justify-center text-sm">Marcar para nurture</button></form>
            </div>

            {signals.length > 0 && <div className="card p-6"><p className="label mb-2">Sinais da conta</p><div className="flex flex-wrap gap-1">{signals.map((s, i) => <span key={i} className="badge-gold">{s}</span>)}</div></div>}
          </div>
        </div>
      </div>
    </ContentArea>
  );
}
