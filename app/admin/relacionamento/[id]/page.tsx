/** Relacionamento · thread (E2) — lê, organiza, responde com gate de envio e IA copiloto. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { ContentArea, PageHeader, Card, Badge } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { AiAssist } from "@/components/AiAssist";
import { MarkReadOnOpen } from "@/components/relacionamento/MarkReadOnOpen";
import { Responder } from "@/components/relacionamento/Responder";
import { CHANNEL_LABELS, STATUS_LABELS, type ConvStatus } from "@/lib/relacionamento/types";
import { getSendPolicy, listTemplates } from "@/lib/relacionamento/responder";
import { assignToMeAction, unassignAction, statusAction, snoozeAction, linkClienteAction, aprovarEnvioFormAction, descartarEnvioAction } from "../actions";

export const dynamic = "force-dynamic";

const STATUSES: ConvStatus[] = ["aberta", "aguardando", "respondida", "arquivada"];
const fmt = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default async function Thread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: c } = await sb.from("rel_conversas").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ data: allMsgs }, { data: orgs }, m, policy, templates] = await Promise.all([
    sb.from("rel_mensagens").select("*").eq("conversa_id", id).order("created_at", { ascending: true }),
    sb.from("organizations").select("id, name").eq("is_salestrack", false).order("name"),
    currentMembership(),
    getSendPolicy(),
    listTemplates(),
  ]);
  const clientName = c.client_id ? (orgs ?? []).find((o) => o.id === c.client_id)?.name : null;
  const mine = c.assigned_to && c.assigned_to === m?.userId;
  const isEmail = c.channel === "email";

  // Rascunhos de saída pendentes (fila de aprovação) ficam separados da conversa em si.
  const msgs = (allMsgs ?? []).filter((mm) => mm.status_entrega !== "rascunho");
  const pendentes = (allMsgs ?? []).filter((mm) => mm.direction === "out" && mm.status_entrega === "rascunho");

  const contatoNome = c.contato_nome || c.contato_email || "";
  // Contexto para o copiloto (dados internos; sem PII em URL).
  const aiContext = [
    `Assunto: ${c.assunto ?? "(sem assunto)"}`,
    `Contato: ${contatoNome}${c.contato_email ? ` <${c.contato_email}>` : ""}`,
    `Cliente vinculado: ${clientName ?? "—"}`,
    "",
    "Mensagens (mais antiga → mais recente):",
    ...msgs.map((mm) => `[${mm.direction === "out" ? "NÓS" : "CLIENTE"} · ${fmt(mm.created_at)}] ${mm.corpo || "(sem prévia)"}`),
  ].join("\n");

  const lbl = "mb-1 block font-montserrat text-[11px] font-medium uppercase tracking-[.12em] text-[color:var(--fg-3)]";

  return (
    <ContentArea>
      <MarkReadOnOpen id={id} unread={!!c.unread} />
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Relacionamento", href: "/admin/relacionamento" }, { label: c.assunto || "Conversa" }]} className="mb-4" />
      <PageHeader eyebrow={`${CHANNEL_LABELS[c.channel as "email" | "whatsapp"]} · ${contatoNome || "—"}`} title={c.assunto || "(sem assunto)"}
        actions={<Link href="/admin/relacionamento" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Voltar à caixa</Link>} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* conversa + responder */}
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-hairline px-4 py-2.5"><p className="ds-eyebrow !mb-0">Conversa · {msgs.length} mensagem(ns)</p></div>
          <div className="space-y-3 p-4">
            {msgs.length === 0 ? <p className="ds-small">Sem mensagens sincronizadas nesta conversa.</p> : msgs.map((mm) => (
              <div key={mm.id} className={`max-w-[85%] rounded-ds-card border p-3 ${mm.direction === "out" ? "ml-auto border-[color:var(--brand-light)] bg-[var(--tile)]" : "border-hairline bg-[var(--bg-2)]"}`}>
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone={mm.direction === "out" ? "brand" : "neutral"}>{mm.direction === "out" ? "enviado" : "recebido"}</Badge>
                  {mm.status_entrega === "falha" && <Badge tone="warn">falhou</Badge>}
                  <span className="font-jbmono text-[10px] text-[color:var(--fg-4)]">{fmt(mm.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-1)]">{mm.corpo || "(sem prévia)"}</p>
              </div>
            ))}
          </div>

          {/* fila de aprovação */}
          {pendentes.length > 0 && (
            <div className="border-t border-hairline bg-[var(--tile)] p-4">
              <p className="mb-2 font-montserrat text-[13px] font-semibold text-[color:var(--brand-deep)]">Aguardando aprovação · {pendentes.length}</p>
              <div className="space-y-2">
                {pendentes.map((p) => (
                  <div key={p.id} className="rounded-ds-card border border-[color:var(--brand-light)] bg-[var(--bg-1)] p-3">
                    <p className="mb-2 whitespace-pre-wrap font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-1)]">{p.corpo}</p>
                    <div className="flex gap-2">
                      <form action={aprovarEnvioFormAction.bind(null, p.id, id)}><button className="ds-focus rounded-ds-input bg-brand px-3 py-1.5 font-montserrat text-[12px] font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Aprovar e enviar</button></form>
                      <form action={descartarEnvioAction.bind(null, p.id, id)}><button className="ds-focus rounded-ds-input border border-hairline-strong px-3 py-1.5 font-montserrat text-[12px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Descartar</button></form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* responder */}
          {isEmail
            ? <Responder conversaId={id} policy={policy} templates={templates} contatoNome={contatoNome} assunto={c.assunto || ""} />
            : <div className="border-t border-hairline px-4 py-3"><p className="ds-small !mt-0">Responder WhatsApp chega no <b>E3</b>.</p></div>}
        </Card>

        {/* lateral: copiloto + organizar + vincular */}
        <div className="space-y-4">
          {isEmail && (
            <Card bloom>
              <AiAssist title="Copiloto da caixa" compact context={aiContext} actions={[
                { label: "Resumir a thread", task: "Resuma esta conversa em 3–5 bullets: contexto, o que o contato pede e o que está pendente do nosso lado." },
                { label: "Triagem/prioridade", task: "Classifique a prioridade (alta/média/baixa) e diga em uma frase o que responder primeiro e por quê." },
                { label: "Sugerir resposta", task: "Rascunhe uma resposta pronta para enviar ao contato, no tom da marca Salestrack, objetiva e cordial. Não invente fatos; se faltar dado, deixe um [placeholder]." },
                { label: "Extrair tarefas", task: "Liste como checklist as tarefas/compromissos que esta conversa gera para nós, com prazos se mencionados." },
              ]} />
              <p className="ds-small !mb-0 mt-2">A IA rascunha; você edita e aprova antes de enviar.</p>
            </Card>
          )}

          <Card>
            <p className="mb-2 font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">Organizar</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone={c.status === "aberta" ? "warn" : "neutral"}>{STATUS_LABELS[c.status as ConvStatus] ?? c.status}</Badge>
              {c.assigned_to ? <Badge tone="brand">{mine ? "atribuída a você" : "atribuída"}</Badge> : <Badge tone="neutral">não atribuída</Badge>}
              {c.snooze_until && <Badge tone="warn">follow-up {new Date(c.snooze_until).toLocaleDateString("pt-BR")}</Badge>}
            </div>

            <p className={lbl}>Atribuição</p>
            <div className="mb-3 flex gap-2">
              {mine
                ? <form action={unassignAction.bind(null, id)}><button className="ds-focus rounded-ds-input border border-hairline-strong px-3 py-1.5 font-montserrat text-[12px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Soltar</button></form>
                : <form action={assignToMeAction.bind(null, id)}><button className="ds-focus rounded-ds-input bg-brand px-3 py-1.5 font-montserrat text-[12px] font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Assumir p/ mim</button></form>}
            </div>

            <p className={lbl}>Status</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {STATUSES.filter((s) => s !== c.status).map((s) => (
                <form key={s} action={statusAction.bind(null, id, s)}><button className="ds-focus rounded-ds-pill border border-hairline px-2.5 py-1 font-montserrat text-[11px] text-[color:var(--fg-2)] hover:border-[color:var(--brand-light)]">{STATUS_LABELS[s]}</button></form>
              ))}
            </div>

            <p className={lbl}>Follow-up (snooze)</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 3, 7].map((d) => <form key={d} action={snoozeAction.bind(null, id, d)}><button className="ds-focus rounded-ds-pill border border-hairline px-2.5 py-1 font-montserrat text-[11px] text-[color:var(--fg-2)] hover:border-[color:var(--brand-light)]">+{d}d</button></form>)}
              {c.snooze_until && <form action={snoozeAction.bind(null, id, 0)}><button className="ds-focus rounded-ds-pill border border-hairline px-2.5 py-1 font-montserrat text-[11px] text-[color:var(--fg-3)]">limpar</button></form>}
            </div>
          </Card>

          <Card bloom>
            <p className="mb-1 font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">Vincular ao cliente</p>
            <p className="ds-small !mt-0 mb-3">Etiqueta de CRM — registra a conversa na <b>timeline</b> do cliente (não é acesso ao sistema dele).</p>
            {clientName && <p className="mb-2 font-montserrat text-[12px] text-[color:var(--brand-deep)]"><Icon name="team" size={13} className="inline" /> Vinculada a <b>{clientName}</b></p>}
            <form action={linkClienteAction.bind(null, id)} className="flex gap-2">
              <select name="client_id" defaultValue={c.client_id ?? ""} className="h-10 flex-1 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-sm text-[color:var(--fg-1)]">
                <option value="">— nenhum —</option>
                {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <button className="ds-focus rounded-ds-input bg-brand px-3 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Vincular</button>
            </form>
          </Card>
        </div>
      </div>
    </ContentArea>
  );
}
