import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { ContentArea, PageHeader, Card, Badge, EmptyState, botaoClasses } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { TEMPLATES } from "@/lib/marketing/templates";
import { montarAudiencia } from "@/lib/marketing/audiencia";
import { resendConfigurado } from "@/lib/marketing/disparo";
import { criarCampanha } from "./actions";

export const dynamic = "force-dynamic";

const TOM: Record<string, "neutral" | "warn" | "brand" | "success" | "danger"> = {
  rascunho: "neutral", aguardando_aprovacao: "warn", aprovada: "brand",
  enviando: "warn", enviada: "success", cancelada: "neutral",
};
const ROTULO: Record<string, string> = {
  rascunho: "rascunho", aguardando_aprovacao: "aguardando aprovação", aprovada: "aprovada",
  enviando: "enviando", enviada: "enviada", cancelada: "cancelada",
};

export default async function EmailMarketing() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Marketing" title="E-mail marketing" subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const sb = await createClient();
  const [{ data: campanhas }, audiencia] = await Promise.all([
    sb.from("email_campanhas").select("id, nome, assunto, status, enviada_em, created_at")
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    montarAudiencia(),
  ]);

  const lista = campanhas ?? [];
  const podem = audiencia.destinatarios.length;

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Marketing", href: "/admin/marketing" }, { label: "E-mail" }]} className="mb-4" />
      <PageHeader eyebrow="Marketing · E-mail" title="Campanhas de e-mail"
        subtitle="Monte, teste e dispare. A lista sai de quem autorizou receber — e nada sai sem aprovação."
        actions={<Link href="/admin/marketing/email/lista" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]"><Icon name="team" size={15} /> Lista e bloqueios</Link>} />

      {/* O estado que decide se a ferramenta funciona hoje. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card className={podem === 0 ? "border-[color:var(--warn)]" : undefined}>
          <p className="font-jbmono text-[26px] text-[color:var(--fg-1)]">{podem}</p>
          <p className="ds-small !mt-0">pessoa(s) podem receber marketing hoje</p>
          {podem === 0 && (
            <p className="mt-2 font-montserrat text-[12.5px] leading-snug text-[color:var(--fg-2)]">
              A lista está vazia porque ninguém consentiu ainda — e dado de prospecção não pode virar
              lista de marketing. Você pode montar e testar campanhas desde já.
            </p>
          )}
          <p className="mt-2 font-montserrat text-[12.5px] leading-snug text-[color:var(--fg-3)]">
            A lista cresce por <a href="/inscrever" target="_blank" rel="noopener noreferrer" className="text-[color:var(--brand)] hover:underline">salestrack.com.br/inscrever</a> —
            divulgue esse link. Quem se inscreve confirma por e-mail antes de entrar, e é esse clique
            que vale como consentimento.
          </p>
        </Card>
        <Card className={resendConfigurado() ? undefined : "border-[color:var(--warn)]"}>
          <p className="font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">
            Resend {resendConfigurado() ? "conectado" : "não configurado"}
          </p>
          <p className="ds-small !mt-0">
            {resendConfigurado()
              ? "Disparo e teste funcionando. Para receber abertura, clique e bounce, configure também o webhook (item 15 do CONFIG_PENDENTE)."
              : "Sem RESEND_API_KEY não há envio nem teste — o editor funciona, o disparo não."}
          </p>
        </Card>
      </div>

      {/* Começar do zero ou de um modelo */}
      <Card className="mb-6">
        <p className="mb-1 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Nova campanha</p>
        <p className="ds-small !mt-0 mb-4">
          Os modelos vêm escritos ponta a ponta, no tom da Salestrack. Dá para enviar trocando três frases —
          modelo com texto de mentira devolve a folha em branco para quem abriu para não encarar uma.
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {TEMPLATES.map((t) => (
            <form key={t.slug} action={criarCampanha} className="rounded-ds-card border border-hairline p-3 hover:border-[color:var(--brand-light)]">
              <input type="hidden" name="template" value={t.slug} />
              <input type="hidden" name="nome" value={t.nome} />
              <p className="font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">{t.nome}</p>
              <p className="ds-small !mt-0.5 mb-2">{t.quando}</p>
              <button className="ds-focus rounded-ds-input border border-hairline-strong px-3 py-1.5 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Usar este modelo</button>
            </form>
          ))}
          <form action={criarCampanha} className="rounded-ds-card border border-dashed border-hairline p-3">
            <input type="hidden" name="nome" value="Campanha em branco" />
            <p className="font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">Do zero</p>
            <p className="ds-small !mt-0.5 mb-2">Sem modelo — você monta os blocos.</p>
            <button className="ds-focus rounded-ds-input border border-hairline-strong px-3 py-1.5 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Criar em branco</button>
          </form>
        </div>
      </Card>

      {lista.length === 0 ? (
        <Card><EmptyState icon={<Icon name="chat" size={22} />} title="Nenhuma campanha ainda"
          description="Escolha um modelo acima para começar." /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-[color:var(--border)]">
            {lista.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/marketing/email/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-2)]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-montserrat text-[14px] font-medium text-[color:var(--fg-1)]">{c.nome}</span>
                    <span className="block truncate font-montserrat text-[13px] text-[color:var(--fg-3)]">{c.assunto || "(sem assunto)"}</span>
                  </span>
                  <Badge tone={TOM[c.status as string] ?? "neutral"}>{ROTULO[c.status as string] ?? c.status}</Badge>
                  <span className="font-jbmono text-[12px] text-[color:var(--fg-4)]">
                    {new Date((c.enviada_em ?? c.created_at) as string).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </ContentArea>
  );
}
