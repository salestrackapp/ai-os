import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { ContentArea, PageHeader, Card, Badge, EmptyState } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { montarAudiencia } from "@/lib/marketing/audiencia";
import { suprimirEndereco } from "../actions";

export const dynamic = "force-dynamic";

const MOTIVO: Record<string, string> = {
  bounce_duro: "E-mail não existe ou recusou a entrega",
  reclamacao: "Marcou um envio nosso como spam",
  manual: "Bloqueado pela equipe",
};

export default async function ListaPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) return <ContentArea><PageHeader eyebrow="Marketing" title="Lista" subtitle="Restrito à equipe Salestrack." /></ContentArea>;

  const sb = await createClient();
  const [audiencia, { data: suprimidos }] = await Promise.all([
    montarAudiencia(),
    sb.from("email_supressao").select("email, motivo, detalhe, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Marketing", href: "/admin/marketing" }, { label: "E-mail", href: "/admin/marketing/email" }, { label: "Lista" }]} className="mb-4" />
      <PageHeader eyebrow="Marketing · E-mail" title="Quem pode receber"
        subtitle="A lista não é a base de contatos: é quem autorizou. Aqui dá para ver quem entra, quem não entra e por quê." />

      <Card className="mb-6">
        <p className="ds-body">
          A audiência sai de <b>quem consentiu receber marketing</b>, não de quem está na base. Três
          portões, avaliados de novo a cada disparo:
        </p>
        <ol className="mt-3 space-y-1.5">
          {[
            "Consentimento de marketing vigente, dado pela própria pessoa.",
            "Procedência: quem veio de coleta pública ou de terceiro nunca entra, mesmo com consentimento registrado — dado de prospecção não vira lista de marketing.",
            "Supressão: bounce duro e reclamação de spam bloqueiam para sempre.",
          ].map((t, i) => (
            <li key={i} className="font-montserrat text-[13.5px] leading-snug text-[color:var(--fg-2)]">
              <span className="mr-1.5 font-jbmono text-[color:var(--brand)]">{i + 1}.</span>{t}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <p className="mb-1 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">
            Podem receber <Badge tone="brand">{audiencia.destinatarios.length}</Badge>
          </p>
          {audiencia.destinatarios.length === 0 ? (
            <EmptyState icon={<Icon name="team" size={20} />} title="Ninguém ainda"
              description="A lista cresce pelos formulários dos sites, onde a pessoa marca a caixa de aceite. Campanhas podem ser montadas e testadas desde já." />
          ) : (
            <ul className="divide-y divide-[color:var(--border)]">
              {audiencia.destinatarios.map((d) => (
                <li key={d.email} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-montserrat text-[13.5px] text-[color:var(--fg-1)]">{d.nomeCompleto ?? d.email}</span>
                    {d.nomeCompleto && <span className="block truncate font-montserrat text-[12.5px] text-[color:var(--fg-3)]">{d.email}</span>}
                  </span>
                  {d.empresa && <Badge tone="neutral">{d.empresa}</Badge>}
                </li>
              ))}
            </ul>
          )}
          {audiencia.origens.length > 0 && (
            <p className="mt-3 border-t border-hairline pt-2 font-montserrat text-[12.5px] text-[color:var(--fg-3)]">
              Por origem: {audiencia.origens.map((o) => `${o.origem} (${o.total})`).join(" · ")}
            </p>
          )}
        </Card>

        <div className="space-y-5">
          {audiencia.excluidos.length > 0 && (
            <Card>
              <p className="mb-2 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">
                Consentiram, mas não entram <Badge tone="warn">{audiencia.excluidos.length}</Badge>
              </p>
              <ul className="space-y-1.5">
                {audiencia.excluidos.map((e) => (
                  <li key={e.email} className="font-montserrat text-[12.5px] leading-snug text-[color:var(--fg-3)]">
                    <span className="text-[color:var(--fg-1)]">{e.email}</span><br />{e.motivo}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <p className="mb-1 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">
              Bloqueados para sempre <Badge tone="neutral">{(suprimidos ?? []).length}</Badge>
            </p>
            <p className="ds-small !mt-0 mb-3">
              Fato externo, não decisão da pessoa — por isso fica separado do consentimento. Continuar
              mandando para uma caixa que não existe derruba a entrega de todos os outros envios.
            </p>
            <form action={suprimirEndereco} className="mb-3 flex gap-2">
              <input name="email" type="email" required placeholder="bloquear um endereço…"
                className="flex-1 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 py-2 font-montserrat text-[13.5px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
              <button className="ds-focus rounded-ds-input border border-hairline-strong px-3 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Bloquear</button>
            </form>
            {(suprimidos ?? []).length === 0 ? (
              <p className="font-montserrat text-[13px] text-[color:var(--fg-3)]">Nenhum endereço bloqueado.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--border)]">
                {(suprimidos ?? []).map((s) => (
                  <li key={s.email as string} className="py-2">
                    <span className="block font-montserrat text-[13px] text-[color:var(--fg-1)]">{s.email}</span>
                    <span className="block font-montserrat text-[12.5px] text-[color:var(--fg-3)]">{MOTIVO[s.motivo as string] ?? s.motivo}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <p className="ds-small mt-6">
        Voltar para <Link href="/admin/marketing/email" className="text-[color:var(--brand)] hover:underline">as campanhas</Link>.
      </p>
    </ContentArea>
  );
}
