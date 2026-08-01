import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { ContentArea, PageHeader, Card, Badge } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { EmailBuilder } from "@/components/marketing/EmailBuilder";
import { DispararCampanha } from "@/components/marketing/DispararCampanha";
import { montarAudiencia, type Segmento } from "@/lib/marketing/audiencia";
import { resultadoDaCampanha } from "@/lib/marketing/disparo";
import type { Bloco } from "@/lib/marketing/blocos";
import { aprovarCampanha, duplicarCampanha, arquivarCampanha } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REMETENTE_PADRAO = process.env.EMAIL_MARKETING_FROM ?? "Salestrack AI <aios@salestrack.com.br>";

export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) return <ContentArea><PageHeader eyebrow="Marketing" title="E-mail" subtitle="Restrito à equipe Salestrack." /></ContentArea>;

  const sb = await createClient();
  const { data: c } = await sb.from("email_campanhas").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!c) notFound();

  const segmento = (c.segmento ?? {}) as Segmento;
  const [audiencia, resultado] = await Promise.all([
    montarAudiencia(segmento),
    // A automática também tem resultado — só que ele cresce a cada confirmação, e não de uma vez.
    ["enviada", "enviando"].includes(c.status as string) || c.template_slug === "boas-vindas"
      ? resultadoDaCampanha(id) : Promise.resolve(null),
  ]);

  const enviada = c.status === "enviada";
  const pct = (n: number) => (resultado?.enviados ? Math.round((n / resultado.enviados) * 100) : 0);

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Marketing", href: "/admin/marketing" }, { label: "E-mail", href: "/admin/marketing/email" }, { label: c.nome as string }]} className="mb-4" />
      <PageHeader eyebrow="Campanha de e-mail" title={c.nome as string}
        subtitle={enviada ? "Já enviada — o conteúdo fica congelado para corresponder ao que as pessoas receberam." : "Monte, teste com você mesmo e mande para aprovação. Nada sai sem esse passo."}
        actions={<div className="flex items-center gap-2">
          <form action={duplicarCampanha.bind(null, id)}>
            <button className="ds-focus h-10 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-3 font-montserrat text-sm text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Duplicar</button>
          </form>
          {!enviada && (
            <form action={arquivarCampanha.bind(null, id)}>
              <button className="ds-focus h-10 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-3 font-montserrat text-sm text-[color:var(--fg-3)] hover:bg-[var(--bg-2)]">Arquivar</button>
            </form>
          )}
        </div>} />

      {/* Portão de aprovação e disparo */}
      {c.status === "aguardando_aprovacao" && (
        <Card bloom className="mb-5">
          <p className="mb-1 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Aguardando aprovação</p>
          <p className="ds-small !mt-0 mb-3">
            Vai para <b>{audiencia.destinatarios.length}</b> pessoa(s). Leia o assunto e a prévia como se
            fosse quem recebe — depois de sair não há como recolher.
          </p>
          <form action={async () => { "use server"; await aprovarCampanha(id); }}>
            <button className="ds-focus h-10 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Aprovar campanha</button>
          </form>
        </Card>
      )}

      {/*
        Boas-vindas aprovado NÃO tem botão de disparar — e a ausência é a parte importante.
        Ele já sai sozinho, um por pessoa, no instante da confirmação. Oferecer "disparar agora"
        aqui convidaria a mandar o e-mail de boas-vindas para a lista inteira, incluindo quem já o
        recebeu meses atrás. O botão que não existe é o que evita esse erro.
      */}
      {c.status === "aprovada" && c.template_slug === "boas-vindas" ? (
        <Card bloom className="mb-5">
          <p className="mb-1 font-montserrat text-[15px] font-semibold text-[color:var(--brand-deep)]">
            Automática — sai a cada nova confirmação
          </p>
          <p className="ds-small !mt-0">
            Enquanto estiver aprovada, é este texto que a pessoa recebe no instante em que confirma
            a inscrição. Não há disparo manual: ele acontece um por vez, sozinho. Para mudar o que
            ela lê, edite abaixo e aprove de novo — editar derruba a aprovação de propósito, e até
            você aprovar volta a valer o modelo padrão.
          </p>
          {resultado && (
            <p className="mt-2 font-montserrat text-[13px] text-[color:var(--fg-2)]">
              Já saíram <b>{resultado.enviados}</b> boas-vindas
              {resultado.abertos > 0 && <> · <b>{resultado.abertos}</b> abriram</>}.
            </p>
          )}
        </Card>
      ) : c.status === "aprovada" && (
        <DispararCampanha id={id} total={audiencia.destinatarios.length}
          amostra={audiencia.destinatarios.slice(0, 5).map((d) => d.email)} />
      )}

      {resultado && (
        <Card className="mb-5">
          <p className="mb-3 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Resultado</p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { r: "Enviados", v: String(resultado.enviados) },
              { r: "Entregues", v: `${resultado.entregues}${resultado.enviados ? ` · ${pct(resultado.entregues)}%` : ""}` },
              { r: "Abriram", v: `${resultado.abertos}${resultado.enviados ? ` · ${pct(resultado.abertos)}%` : ""}` },
              { r: "Clicaram", v: `${resultado.clicados}${resultado.enviados ? ` · ${pct(resultado.clicados)}%` : ""}` },
              { r: "Falharam", v: String(resultado.falhas) },
              { r: "Bounce / spam", v: `${resultado.bounces} / ${resultado.reclamacoes}` },
            ].map((x) => (
              <div key={x.r} className="rounded-ds-card border border-hairline bg-[var(--bg-2)] p-3">
                <p className="font-jbmono text-[18px] text-[color:var(--fg-1)]">{x.v}</p>
                <p className="font-montserrat text-[12.5px] text-[color:var(--fg-3)]">{x.r}</p>
              </div>
            ))}
          </div>
          {!process.env.RESEND_WEBHOOK_SECRET && (
            <p className="mt-3 rounded-ds-input bg-[#FFF7E6] px-3 py-2 font-montserrat text-[12.5px] text-[color:var(--fg-1)]">
              Abertura, clique e bounce ficam em zero até o webhook do Resend ser configurado — o envio
              funciona, só o retorno não chega. Item 15 do CONFIG_PENDENTE.
            </p>
          )}
        </Card>
      )}

      {audiencia.excluidos.length > 0 && (
        <Card className="mb-5">
          <p className="mb-2 font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">
            Fora da lista <Badge tone="neutral">{audiencia.excluidos.length}</Badge>
          </p>
          <ul className="space-y-1">
            {audiencia.excluidos.slice(0, 8).map((e) => (
              <li key={e.email} className="font-montserrat text-[12.5px] text-[color:var(--fg-3)]">
                <span className="text-[color:var(--fg-2)]">{e.email}</span> — {e.motivo}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-montserrat text-[12px] text-[color:var(--fg-4)]">
            Ver todos em <Link href="/admin/marketing/email/lista" className="text-[color:var(--brand)] hover:underline">Lista e bloqueios</Link>.
          </p>
        </Card>
      )}

      <EmailBuilder id={id}
        inicial={{
          nome: c.nome as string, assunto: (c.assunto as string) ?? "", preheader: (c.preheader as string) ?? "",
          remetente: (c.remetente as string) ?? "", blocos: (c.blocos ?? []) as Bloco[], segmento, status: c.status as string,
        }}
        origens={audiencia.origens}
        contagem={{ podem: audiencia.destinatarios.length, excluidos: audiencia.excluidos.length }}
        emailDoUsuario={m.email ?? "andre.kachan@salestrack.com.br"}
        remetentePadrao={REMETENTE_PADRAO} />
    </ContentArea>
  );
}
