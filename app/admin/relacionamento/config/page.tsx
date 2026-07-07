/** Relacionamento · Templates & regras (E2). Regras rotulam/roteiam — nunca enviam sozinhas. */
import Link from "next/link";
import { ContentArea, PageHeader, Card, Badge, EmptyState } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { listTemplates, listRegras } from "@/lib/relacionamento/responder";
import { criarTemplateAction, removerTemplateAction, criarRegraAction, removerRegraAction } from "./actions";

export const dynamic = "force-dynamic";

const input = "h-10 w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-sm text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]";
const lbl = "mb-1 block font-montserrat text-[11px] font-medium uppercase tracking-[.12em] text-[color:var(--fg-3)]";
const primary = "ds-focus inline-flex h-10 items-center rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover";

export default async function RelConfig() {
  const [templates, regras, { data: membros }] = await Promise.all([
    listTemplates(), listRegras(),
    (await createClient()).from("memberships").select("user_id, email").eq("role", "salestrack_admin").order("email"),
  ]);
  const nomeMembro = (id: string | null) => id ? ((membros ?? []).find((x) => x.user_id === id)?.email ?? "membro") : null;

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Relacionamento", href: "/admin/relacionamento" }, { label: "Templates & regras" }]} className="mb-4" />
      <PageHeader eyebrow="Relacionamento" title="Templates & regras"
        subtitle="Respostas reutilizáveis e roteamento automático. As regras rotulam e atribuem — nunca enviam sozinhas; o envio sempre passa pelo gate."
        actions={<Link href="/admin/relacionamento" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Voltar à caixa</Link>} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Templates */}
        <div className="space-y-4">
          <Card>
            <p className="mb-3 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Templates / snippets</p>
            <form action={criarTemplateAction} className="space-y-3">
              <div><span className={lbl}>Nome</span><input name="nome" required className={input} placeholder="Ex.: Agendar conversa" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className={lbl}>Assunto (opcional)</span><input name="assunto" className={input} placeholder="Re: {{assunto}}" /></div>
                <div><span className={lbl}>Atalho (opcional)</span><input name="atalho" className={input} placeholder="/agenda" /></div>
              </div>
              <div><span className={lbl}>Corpo</span><textarea name="corpo" required rows={4} className={`${input} h-auto py-2`} placeholder="Olá {{nome}}, …  (use {{nome}} e {{assunto}})" /></div>
              <button className={primary}>Adicionar template</button>
            </form>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-hairline px-4 py-2.5"><p className="ds-eyebrow !mb-0">{templates.length} template(s)</p></div>
            {templates.length === 0 ? <div className="p-6"><EmptyState icon={<Icon name="layers" size={20} />} title="Sem templates" description="Crie o primeiro acima." /></div> : (
              <ul className="divide-y divide-[color:var(--border)]">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-montserrat text-[13px] font-semibold text-[color:var(--fg-1)]">{t.nome} {t.atalho && <Badge tone="neutral">{t.atalho}</Badge>}</p>
                      <p className="mt-0.5 line-clamp-2 font-montserrat text-[12px] text-[color:var(--fg-3)]">{t.corpo}</p>
                    </div>
                    <form action={removerTemplateAction.bind(null, t.id)}><button className="ds-focus shrink-0 rounded-ds-input border border-hairline-strong px-2.5 py-1.5 font-montserrat text-[11px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Remover</button></form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Regras */}
        <div className="space-y-4">
          <Card>
            <p className="mb-1 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Regras de roteamento</p>
            <p className="ds-small !mt-0 mb-3">Ao sincronizar, uma conversa nova que casar recebe rótulo/atribuição. <b>Nunca</b> envia mensagem.</p>
            <form action={criarRegraAction} className="space-y-3">
              <div><span className={lbl}>Nome</span><input name="nome" required className={input} placeholder="Ex.: Financeiro → Contas" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className={lbl}>Quando o campo</span>
                  <select name="match_campo" className={input}><option value="remetente">Remetente contém</option><option value="assunto">Assunto contém</option></select>
                </div>
                <div><span className={lbl}>Valor</span><input name="match_valor" required className={input} placeholder="@financeiro.com" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className={lbl}>Aplicar rótulo (opcional)</span><input name="acao_rotulo" className={input} placeholder="Financeiro" /></div>
                <div><span className={lbl}>Atribuir a (opcional)</span>
                  <select name="acao_assign_to" className={input}><option value="">— ninguém —</option>{(membros ?? []).map((mm) => <option key={mm.user_id} value={mm.user_id}>{mm.email}</option>)}</select>
                </div>
              </div>
              <button className={primary}>Adicionar regra</button>
            </form>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-hairline px-4 py-2.5"><p className="ds-eyebrow !mb-0">{regras.length} regra(s)</p></div>
            {regras.length === 0 ? <div className="p-6"><EmptyState icon={<Icon name="target" size={20} />} title="Sem regras" description="O roteamento automático fica inativo até você criar uma." /></div> : (
              <ul className="divide-y divide-[color:var(--border)]">
                {regras.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-montserrat text-[13px] font-semibold text-[color:var(--fg-1)]">{r.nome}</p>
                      <p className="mt-0.5 font-montserrat text-[12px] text-[color:var(--fg-3)]">Se <b>{r.match_campo}</b> contém “{r.match_valor}” → {r.acao_rotulo ? <>rótulo <Badge tone="brand">{r.acao_rotulo}</Badge> </> : ""}{r.acao_assign_to ? <>atribui a <b>{nomeMembro(r.acao_assign_to)}</b></> : ""}{!r.acao_rotulo && !r.acao_assign_to ? "(sem ação)" : ""}</p>
                    </div>
                    <form action={removerRegraAction.bind(null, r.id)}><button className="ds-focus shrink-0 rounded-ds-input border border-hairline-strong px-2.5 py-1.5 font-montserrat text-[11px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Remover</button></form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </ContentArea>
  );
}
