/** Admin · Diagnóstico do cliente — gera/mostra o link público e as respostas enviadas. */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContentArea, PageHeader, Card, Badge, EmptyState } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { CopyButton } from "@/components/ui/CopyButton";
import { getOrCreateIntakeForOrg, DIAGNOSTICO_SECOES } from "@/lib/diagnostico";

export const dynamic = "force-dynamic";

export default async function DiagnosticoAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: org } = await sb.from("organizations").select("id, name").eq("id", id).maybeSingle();
  if (!org) notFound();

  const intake = await getOrCreateIntakeForOrg(id, `Diagnóstico Digital · ${org.name}`);
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host");
  const url = `${proto}://${host}/diagnostico/${intake.token}`;
  const d = intake.dados ?? {};
  const preenchidos = Object.values(d).filter((v) => String(v ?? "").trim()).length;

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Clientes", href: "/admin/clientes" }, { label: org.name, href: `/admin/clientes/${id}` }, { label: "Diagnóstico" }]} className="mb-4" />
      <PageHeader eyebrow="Cliente" title="Diagnóstico Digital"
        subtitle="Envie o link para o cliente preencher a operação (exames, preços, horários, FAQ, canais). As respostas alimentam o site e o agente de IA."
        actions={<Link href={`/admin/clientes/${id}`} className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Voltar à ficha</Link>} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">Link do formulário</p>
            <p className="ds-small !mt-0">Compartilhe com o cliente (WhatsApp/e-mail). Não exige login.</p>
          </div>
          <Badge tone={intake.status === "enviado" ? "success" : "warn"}>{intake.status === "enviado" ? "enviado pelo cliente" : "aguardando preenchimento"}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-ds-input border border-hairline bg-[var(--bg-2)] px-3 py-2.5 font-jbmono text-[13px] text-[color:var(--fg-2)]">{url}</code>
          <CopyButton text={url} />
          <a href={url} target="_blank" rel="noopener noreferrer" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]"><Icon name="activity" size={14} /> Abrir</a>
        </div>
        {intake.submitted_at && <p className="mt-2 ds-small">Enviado em {new Date(intake.submitted_at).toLocaleString("pt-BR")}.</p>}
      </Card>

      {preenchidos === 0 ? (
        <Card><EmptyState icon={<Icon name="fileText" size={22} />} title="Sem respostas ainda" description="Assim que o cliente preencher o formulário, as respostas aparecem aqui." /></Card>
      ) : (
        <div className="space-y-4">
          <p className="ds-small">{preenchidos} campo(s) preenchido(s).</p>
          {DIAGNOSTICO_SECOES.map((sec) => {
            const comValor = sec.campos.filter((c) => String(d[c.id] ?? "").trim());
            if (!comValor.length) return null;
            return (
              <Card key={sec.titulo} className="!p-0 overflow-hidden">
                <div className="border-b border-hairline px-4 py-2.5"><p className="ds-eyebrow !mb-0">{sec.titulo}</p></div>
                <dl className="divide-y divide-[color:var(--border)]">
                  {comValor.map((c) => (
                    <div key={c.id} className="px-4 py-3">
                      <dt className="font-montserrat text-[13px] font-medium text-[color:var(--fg-3)]">{c.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap font-montserrat text-[13.5px] text-[color:var(--fg-1)]">{d[c.id]}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </ContentArea>
  );
}
