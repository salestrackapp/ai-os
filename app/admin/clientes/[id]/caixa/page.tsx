/** Caixa do cliente — gerenciar e-mails do Gmail (ver threads + enviar ativação) por cliente. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { googleConfigured, listGmail } from "@/lib/google";
import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { sendClientEmail } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const lbl = "mb-1.5 block font-montserrat text-[12px] font-medium text-[color:var(--fg-2)]";
const inp = "w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 py-2 font-montserrat text-sm text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]";

export default async function CaixaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: org } = await sb.from("organizations").select("id, name, is_salestrack").eq("id", id).maybeSingle();
  if (!org || org.is_salestrack) notFound();

  const { data: contacts } = await sb.from("contacts").select("name, email, phone").eq("org_id", id).not("email", "is", null);
  const emails = (contacts ?? []).map((c) => c.email).filter(Boolean) as string[];
  const gOn = await googleConfigured();

  // Threads recentes com os contatos do cliente (Gmail enviados+recebidos)
  const query = emails.length ? emails.map((e) => `from:${e} OR to:${e}`).join(" OR ") : "";
  const threads = gOn && query ? await listGmail(query, 12) : [];

  const primeiro = (contacts ?? [])[0];
  const defaultSubject = `Bem-vindo(a) ao seu programa · ${org.name}`;
  const defaultBody = `Olá${primeiro?.name ? ` ${primeiro.name.split(" ")[0]}` : ""},\n\nÉ um prazer começar o seu programa de IA com a Salestrack. Nos próximos dias você vai receber os primeiros materiais e o acesso ao seu portal, onde acompanha tudo passo a passo.\n\nQualquer dúvida, é só responder este e-mail.\n\nAbraço,\nAndré Kachan · Salestrack AI`;

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Clientes", href: "/admin/clientes" }, { label: org.name, href: `/admin/clientes/${id}` }, { label: "Caixa de e-mail" }]} className="mb-4" />
      <PageHeader eyebrow="Cliente · comunicação" title="Caixa de e-mail (Gmail)"
        subtitle={`Envie a ativação e acompanhe a conversa com ${org.name} pela sua caixa do Gmail.`}
        actions={<Link href={`/admin/clientes/${id}`} className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Voltar à ficha</Link>} />

      {!gOn && (
        <Card className="mb-6 border-[color:var(--warn)]">
          <p className="font-montserrat text-[13.5px] text-[color:var(--fg-1)]"><b>Gmail ainda não conectado.</b> Cole suas chaves do Google em <Link href="/admin/configuracoes/parametros?cat=integracoes" className="text-[color:var(--brand)] hover:underline">Configurações → Integrações</Link> e aperte “Testar conexão”. Enquanto isso, os envios ficam em modo manual.</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Threads recentes */}
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="ds-eyebrow !mb-0">Conversas recentes</p>
            <span className="font-jbmono text-[11px] text-[color:var(--fg-4)]">{threads.length} no Gmail</span>
          </div>
          {emails.length === 0 ? (
            <div className="p-6"><p className="ds-small">Este cliente ainda não tem contatos com e-mail. Cadastre um contato na ficha para ver a conversa aqui.</p></div>
          ) : threads.length === 0 ? (
            <div className="p-6"><p className="ds-small">{gOn ? "Sem e-mails recentes com estes contatos ainda. Envie o primeiro ao lado." : "Conecte o Gmail para ver as conversas."}</p></div>
          ) : (
            <ul className="divide-y divide-[color:var(--border)]">
              {threads.map((t) => (
                <li key={t.ref} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-montserrat text-[13px] font-medium text-[color:var(--fg-1)]">{t.summary}</p>
                      <p className="truncate font-montserrat text-[12px] text-[color:var(--fg-3)]">{t.from ?? "—"}</p>
                    </div>
                    <span className="shrink-0 font-jbmono text-[10px] text-[color:var(--fg-4)]">{t.when ? new Date(t.when).toLocaleDateString("pt-BR") : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Compor ativação */}
        <Card bloom>
          <div className="mb-3 flex items-center gap-2"><Icon name="sparkles" size={16} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Enviar e-mail</p></div>
          <form action={sendClientEmail.bind(null, id)} className="space-y-3">
            <div>
              <label className={lbl} htmlFor="to">Para</label>
              <input id="to" name="to" list="contatos" defaultValue={primeiro?.email ?? ""} placeholder="email@cliente.com" className={inp} required />
              <datalist id="contatos">{(contacts ?? []).map((c) => <option key={c.email} value={c.email!}>{c.name}</option>)}</datalist>
            </div>
            <div><label className={lbl} htmlFor="subject">Assunto</label><input id="subject" name="subject" defaultValue={defaultSubject} className={inp} /></div>
            <div><label className={lbl} htmlFor="body">Mensagem</label><textarea id="body" name="body" rows={9} defaultValue={defaultBody} className={inp} /></div>
            <button className="ds-focus inline-flex h-10 w-full items-center justify-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">
              <Icon name="sparkles" size={15} /> {gOn ? "Enviar pela minha caixa do Gmail" : "Registrar para envio manual"}
            </button>
            <p className="ds-small !mt-2">Sai da sua conta do Gmail (remetente configurado no Console). O corpo não é armazenado — só o registro do envio.</p>
          </form>
        </Card>
      </div>
    </ContentArea>
  );
}
