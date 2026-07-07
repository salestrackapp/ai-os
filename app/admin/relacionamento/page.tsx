/** Relacionamento · Caixa de entrada (E1) — sincroniza e lê o e-mail da Salestrack; organiza e vincula. */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { ContentArea, PageHeader, Card, EmptyState, Badge } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { HelpButton } from "@/components/guidance/HelpButton";
import { AutoRefresh } from "@/components/relacionamento/AutoRefresh";
import { AtivarRecebimentoWA } from "@/components/relacionamento/AtivarRecebimentoWA";
import { googleConfigured } from "@/lib/google";
import { zapiConfigured } from "@/lib/whatsapp";
import { syncGmailInbox } from "@/lib/relacionamento/sync-email";
import { FILTER_LABELS, STATUS_LABELS, isSlaBreached, type InboxFilter, type Channel, type ConvStatus } from "@/lib/relacionamento/types";
import { getNumber } from "@/lib/settings/resolve";
import { syncInboxAction, bulkAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FILTERS: InboxFilter[] = ["todas", "minhas", "nao_atribuidas"];
const chip = (active: boolean) => `rounded-ds-pill border px-3 py-1 font-montserrat text-[12px] transition-colors ${active ? "border-[color:var(--brand)] bg-[var(--tile)] text-[color:var(--brand-deep)]" : "border-hairline text-[color:var(--fg-3)] hover:border-[color:var(--brand-light)]"}`;
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";

export default async function Relacionamento({ searchParams }: { searchParams: Promise<{ canal?: string; filtro?: string; q?: string }> }) {
  const sp = await searchParams;
  const canalParam: "email" | "whatsapp" | "todos" = sp.canal === "whatsapp" ? "whatsapp" : sp.canal === "todos" ? "todos" : "email";
  const isTodos = canalParam === "todos";
  const isEmail = canalParam === "email";
  const filtro: InboxFilter = FILTERS.includes(sp.filtro as InboxFilter) ? (sp.filtro as InboxFilter) : "todas";
  const q = (sp.q ?? "").trim();
  const [gOn, wOn, slaHoras] = await Promise.all([googleConfigured(), zapiConfigured(), getNumber("rel_sla_horas")]);
  const canalOn = isTodos ? (gOn || wOn) : isEmail ? gOn : wOn;
  const sla = slaHoras ?? 24;
  const nowISO = new Date().toISOString();
  const m = await currentMembership();

  // Auto-sincroniza o Gmail ao abrir/atualizar a caixa (real-time, sem depender do botão). Best-effort.
  if ((isEmail || isTodos) && gOn) { try { await syncGmailInbox(30); } catch { /* nunca derruba a listagem */ } }

  const sb = await createClient();
  let query = sb.from("rel_conversas").select("id, channel, assunto, contato_nome, contato_email, contato_phone, status, assigned_to, unread, last_message_at, client_id")
    .is("deleted_at", null).order("last_message_at", { ascending: false, nullsFirst: false }).limit(100);
  if (!isTodos) query = query.eq("channel", canalParam);
  if (filtro === "minhas") query = query.eq("assigned_to", m?.userId ?? "");
  else if (filtro === "nao_atribuidas") query = query.is("assigned_to", null);
  const qs = q.replace(/[,()%*]/g, " ").trim(); // sanitiza p/ o filtro .or (vírgula/parênteses são sintaxe)
  if (qs) query = query.or(`assunto.ilike.%${qs}%,contato_nome.ilike.%${qs}%,contato_email.ilike.%${qs}%,contato_phone.ilike.%${qs}%`);
  const { data: convs } = await query;
  const list = convs ?? [];

  const naoLidas = list.filter((c) => c.unread).length;
  const atrasadas = list.filter((c) => isSlaBreached({ status: c.status as ConvStatus, last_message_at: c.last_message_at }, sla, nowISO)).length;
  const canalHref = (c: "email" | "whatsapp" | "todos") => `/admin/relacionamento?canal=${c}`;
  const filtroHref = (f: InboxFilter) => `/admin/relacionamento?canal=${canalParam}&filtro=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <ContentArea>
      <AutoRefresh seconds={20} />
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Relacionamento" }]} className="mb-4" />
      <PageHeader eyebrow="Relacionamento" title="Caixa da equipe"
        subtitle="Leia e organize o e-mail e o WhatsApp da Salestrack, atribua a um membro e vincule ao cliente — as mensagens aparecem na timeline dele."
        comoUsar={<HelpButton routeKey="/admin/relacionamento" />}
        actions={<div className="flex items-center gap-2">
          <Link href="/admin/relacionamento/config" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]"><Icon name="layers" size={15} /> Templates & regras</Link>
          <Link href="/admin/relacionamento/relatorios" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]"><Icon name="trending" size={15} /> Relatórios</Link>
          {(isEmail || isTodos) && (
            <form action={syncInboxAction}>
              <button className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"><Icon name="activity" size={15} /> Sincronizar Gmail</button>
            </form>
          )}
        </div>} />

      {/* seletor de canal */}
      <div className="mb-4 flex gap-2">
        <Link href={canalHref("todos")} className={chip(isTodos)}>Todos os canais</Link>
        <Link href={canalHref("email")} className={chip(isEmail)}>Caixa de entrada</Link>
        <Link href={canalHref("whatsapp")} className={chip(canalParam === "whatsapp")}>Mensagens (WhatsApp)</Link>
      </div>

      {!canalOn && (
        <Card className="mb-4 border-[color:var(--warn)]"><p className="font-montserrat text-[13.5px] text-[color:var(--fg-1)]">
          {isEmail
            ? <><b>Gmail não conectado.</b> Conecte em <Link href="/admin/configuracoes/parametros?cat=integracoes" className="text-[color:var(--brand)] hover:underline">Configurações → Integrações</Link> para sincronizar a caixa.</>
            : <><b>WhatsApp (Z-API) não conectado.</b> Conecte em <Link href="/admin/configuracoes/parametros?cat=integracoes" className="text-[color:var(--brand)] hover:underline">Configurações → Integrações</Link> e aponte o webhook de recebimento para receber as conversas.</>}
        </p></Card>
      )}
      {canalParam === "whatsapp" && wOn && <AtivarRecebimentoWA />}
      {canalParam === "whatsapp" && (
        <p className="ds-small mb-3">As conversas chegam em <b>tempo real</b> pelo webhook da Z-API. Se ainda não chegam, clique em <b>Ativar recebimento</b> acima.</p>
      )}
      {(
        <>
          {/* filtros + busca */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">{FILTERS.map((f) => <Link key={f} href={filtroHref(f)} className={chip(filtro === f)}>{FILTER_LABELS[f]}</Link>)}</div>
            <form className="flex gap-2" method="get">
              <input type="hidden" name="canal" value={canalParam} /><input type="hidden" name="filtro" value={filtro} />
              <input name="q" defaultValue={q} placeholder={isEmail ? "Buscar por remetente ou assunto…" : "Buscar por contato ou telefone…"} aria-label="Buscar na caixa"
                className="h-10 w-64 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-sm text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
              <button className="ds-focus rounded-ds-input border border-hairline-strong px-3 font-montserrat text-sm text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Buscar</button>
            </form>
          </div>

          <p className="ds-small mb-2">{list.length} conversa(s){naoLidas ? ` · ${naoLidas} não lida(s)` : ""}{atrasadas ? ` · ${atrasadas} atrasada(s) (SLA ${sla}h)` : ""}{q ? ` · busca “${q}”` : ""}</p>

          {list.length === 0 ? (
            <Card className="!p-0 overflow-hidden"><div className="p-6"><EmptyState icon={<Icon name="chat" size={22} />} title="Nada por aqui ainda"
              description={q ? "Nenhuma conversa casou com a busca." : isEmail ? "Clique em ‘Sincronizar Gmail’ para trazer os e-mails da caixa da Salestrack." : "As conversas de WhatsApp aparecem aqui assim que chegarem pelo webhook da Z-API."} /></div></Card>
          ) : (
            <form action={bulkAction}>
              {/* barra de ações em massa (aplica ao que estiver marcado) */}
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 font-montserrat text-[11px] uppercase tracking-[.12em] text-[color:var(--fg-3)]">Em massa:</span>
                <button name="op" value="assumir" className="ds-focus rounded-ds-pill border border-hairline px-2.5 py-1 font-montserrat text-[11px] text-[color:var(--fg-2)] hover:border-[color:var(--brand-light)]">Assumir p/ mim</button>
                <button name="op" value="status:respondida" className="ds-focus rounded-ds-pill border border-hairline px-2.5 py-1 font-montserrat text-[11px] text-[color:var(--fg-2)] hover:border-[color:var(--brand-light)]">Marcar respondida</button>
                <button name="op" value="status:arquivada" className="ds-focus rounded-ds-pill border border-hairline px-2.5 py-1 font-montserrat text-[11px] text-[color:var(--fg-2)] hover:border-[color:var(--brand-light)]">Arquivar</button>
                <button name="op" value="snooze:3" className="ds-focus rounded-ds-pill border border-hairline px-2.5 py-1 font-montserrat text-[11px] text-[color:var(--fg-2)] hover:border-[color:var(--brand-light)]">Follow-up +3d</button>
              </div>
              <Card className="!p-0 overflow-hidden">
                <ul className="divide-y divide-[color:var(--border)]">
                  {list.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 transition-colors hover:bg-[var(--bg-2)]">
                      <label className="flex h-full shrink-0 items-center pl-4"><input type="checkbox" name="ids" value={c.id} className="h-4 w-4 accent-[var(--brand)]" aria-label="Selecionar conversa" /></label>
                      <Link href={`/admin/relacionamento/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${c.unread ? "bg-[var(--brand)]" : "bg-transparent"}`} />
                        {isTodos && <Badge tone={c.channel === "whatsapp" ? "success" : "neutral"}>{c.channel === "whatsapp" ? "WA" : "E-mail"}</Badge>}
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate font-montserrat text-[13px] ${c.unread ? "font-semibold text-[color:var(--fg-1)]" : "text-[color:var(--fg-2)]"}`}>{c.contato_nome || c.contato_email || c.contato_phone || "—"}</span>
                          <span className="block truncate font-montserrat text-[12px] text-[color:var(--fg-3)]">{c.assunto || "(sem assunto)"}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {isSlaBreached({ status: c.status as ConvStatus, last_message_at: c.last_message_at }, sla, nowISO) && <Badge tone="warn">atrasada</Badge>}
                          {c.client_id && <Badge tone="brand">cliente</Badge>}
                          <Badge tone={c.status === "aberta" ? "warn" : "neutral"}>{STATUS_LABELS[c.status as ConvStatus] ?? c.status}</Badge>
                          <span className="font-jbmono text-[11px] text-[color:var(--fg-4)]">{fmtDate(c.last_message_at)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </form>
          )}
        </>
      )}
    </ContentArea>
  );
}
