/** Portal · Minha Jornada (U4) — o cliente vê onde está, o próximo passo e acessa suas entregas. */
import Link from "next/link";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { resolvePortalOrg } from "@/lib/portal";
import { getJourneyForClient } from "@/lib/journey";
import { JOURNEY_STAGES, STAGE_CLIENTE } from "@/lib/journey/stages";
import { getOrCreateIntakeForOrg } from "@/lib/diagnostico";
import { ContentArea, PageHeader, Card, Badge, EmptyState } from "@/components/ds";
import { Icon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function MinhaJornada() {
  const ctx = await resolvePortalOrg();
  const orgId = ctx?.orgId ?? null;
  const journey = orgId ? await getJourneyForClient() : null;

  if (!orgId || !journey) {
    return (
      <ContentArea>
        <PageHeader eyebrow="Minha Jornada" title="Bem-vindo à Salestrack AI" subtitle="Sua jornada de transformação aparece aqui assim que começarmos." />
        <Card><EmptyState icon={<Icon name="rocket" size={22} />} title="Preparando sua jornada" description="Em breve você verá cada etapa aqui. Qualquer dúvida, fale com a Salestrack." /></Card>
      </ContentArea>
    );
  }

  const { row, states } = journey;
  const sb = createServiceClient();
  const [{ data: branding }, intake, { data: dels }] = await Promise.all([
    sb.from("tenant_branding").select("internal_name").eq("org_id", orgId).maybeSingle(),
    getOrCreateIntakeForOrg(orgId),
    sb.from("studio_deliverables").select("id").eq("org_id", orgId).in("status", ["aprovado", "entregue", "publicado"]).is("deleted_at", null),
  ]);
  const nome = branding?.internal_name ?? row.orgName;
  const nEntregas = (dels ?? []).length;
  const h = await headers();
  const diagUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/diagnostico/${intake.token}`;
  const statusDe = (etapa: number) => states.find((s) => s.etapa === etapa)?.status ?? "pendente";

  // CTA contextual do próximo passo
  const cta = row.etapaAtual === 2 && intake.status !== "enviado"
    ? { label: "Preencher meu diagnóstico", href: diagUrl, externo: true }
    : nEntregas > 0
      ? { label: "Ver minhas entregas", href: "/portal/entregaveis", externo: false }
      : { label: "Falar com a Salestrack", href: "/portal/consultor", externo: false };

  // Revelação progressiva: o que já faz sentido para a etapa atual
  const extras: { label: string; href: string; icon: string; min: number }[] = [
    { label: "Playbook", href: "/portal/playbook", icon: "graduation", min: 3 },
    { label: "Consultor", href: "/portal/consultor", icon: "chat", min: 3 },
    { label: "Sessões ao vivo", href: "/portal/sessoes", icon: "calendar", min: 5 },
    { label: "ROI do programa", href: "/portal/roi", icon: "trending", min: 5 },
    { label: "Meu stack de IA", href: "/portal/stack", icon: "layers", min: 6 },
    { label: "Governança", href: "/portal/governanca", icon: "shield", min: 6 },
  ].filter((e) => row.etapaAtual >= e.min);

  return (
    <ContentArea>
      <PageHeader eyebrow="Minha Jornada" title={nome}
        subtitle={`Etapa atual: ${STAGE_CLIENTE[row.etapaAtual]} · ${row.progresso}% concluído`} />

      {/* stepper das 6 etapas (linguagem do cliente) */}
      <Card className="mb-6" bloom>
        <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
          {JOURNEY_STAGES.map((s) => {
            const st = statusDe(s.etapa);
            const atual = s.etapa === row.etapaAtual;
            const cor = st === "concluido" ? "var(--success)" : atual ? "var(--brand)" : "var(--border)";
            return (
              <div key={s.etapa} className="min-w-[100px] flex-1">
                <div className="h-1.5 rounded-full" style={{ background: cor }} />
                <p className={`mt-2 font-montserrat text-[12px] ${atual ? "font-semibold text-[color:var(--fg-1)]" : "text-[color:var(--fg-3)]"}`}>{STAGE_CLIENTE[s.etapa]}</p>
                <p className="font-montserrat text-[10.5px] text-[color:var(--fg-4)]">{st === "concluido" ? "concluído" : atual ? "em andamento" : "em breve"}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          <p className="font-montserrat text-[14px] text-[color:var(--fg-1)]"><span className="text-[color:var(--fg-4)]">Próximo passo:</span> <b>{row.proximaAcao}</b></p>
          {cta.externo
            ? <a href={cta.href} target="_blank" rel="noopener noreferrer" className="ds-focus inline-flex h-10 items-center rounded-ds-input bg-brand px-5 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">{cta.label}</a>
            : <Link href={cta.href} className="ds-focus inline-flex h-10 items-center rounded-ds-input bg-brand px-5 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">{cta.label}</Link>}
        </div>
      </Card>

      {/* atalhos principais */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link href="/portal/entregaveis" className="group flex items-center gap-3 rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4 shadow-ds-xs transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-light)]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--tile)] text-[color:var(--brand)]"><Icon name="fileText" size={17} /></span>
          <span className="min-w-0 flex-1"><span className="block font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">Minhas entregas</span><span className="font-montserrat text-[12px] text-[color:var(--fg-3)]">{nEntregas ? `${nEntregas} pronta(s) para acessar` : "Suas entregas aparecerão aqui"}</span></span>
          {nEntregas > 0 && <Badge tone="brand">{nEntregas}</Badge>}
        </Link>
        <Link href="/portal/conta" className="group flex items-center gap-3 rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4 shadow-ds-xs transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-light)]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--tile)] text-[color:var(--brand)]"><Icon name="settings" size={17} /></span>
          <span className="min-w-0 flex-1"><span className="block font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">Minha conta</span><span className="font-montserrat text-[12px] text-[color:var(--fg-3)]">Dados, financeiro e acesso</span></span>
        </Link>
      </div>

      {/* revelação progressiva */}
      {extras.length > 0 && (
        <div>
          <p className="ds-eyebrow mb-2">Disponível para você agora</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map((e) => (
              <Link key={e.href} href={e.href} className="flex items-center gap-2.5 rounded-ds-card border border-hairline bg-[var(--bg-1)] p-3.5 shadow-ds-xs transition-all hover:border-[color:var(--brand-light)]">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--tile)] text-[color:var(--brand)]"><Icon name={e.icon} size={15} /></span>
                <span className="font-montserrat text-[13px] font-medium text-[color:var(--fg-1)]">{e.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </ContentArea>
  );
}
