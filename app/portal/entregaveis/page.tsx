/** Portal · Minhas entregas (U4) — multiformato, consumo passo a passo (reusa /entregavel/[token] do UC). */
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { ContentArea, PageHeader, Card, Badge, EmptyState, botaoClasses } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { resolvePortalOrg } from "@/lib/portal";
import { tipoDef, familiaLabel, progressoModulos, isPassoAPasso } from "@/lib/estudio/catalogo";
import { aceitarEntregaAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MinhasEntregas() {
  const ctx = await resolvePortalOrg();
  const orgId = ctx?.orgId ?? null;
  if (!orgId) return <ContentArea><PageHeader eyebrow="Minhas entregas" title="Entregas" /><Card><EmptyState icon={<Icon name="fileText" size={22} />} title="Sem acesso" description="Faça login para ver suas entregas." /></Card></ContentArea>;

  const sb = createServiceClient();
  const { data: list } = await sb.from("studio_deliverables")
    .select("id, title, kind, status, public_token, external_url, delivered_at")
    .eq("org_id", orgId).in("status", ["aprovado", "entregue", "publicado"]).is("deleted_at", null)
    .order("created_at", { ascending: false });
  const dels = list ?? [];

  // progresso dos passo-a-passo (módulos totais + concluídos por org)
  const idsPasso = dels.filter((d) => isPassoAPasso(d.kind)).map((d) => d.id);
  const totalMod = new Map<string, number>(), feitosMod = new Map<string, number>();
  if (idsPasso.length) {
    const [{ data: mods }, { data: prog }] = await Promise.all([
      sb.from("studio_modules").select("deliverable_id").in("deliverable_id", idsPasso),
      sb.from("deliverable_progress").select("deliverable_id").in("deliverable_id", idsPasso).eq("subject_type", "org").eq("subject_id", orgId),
    ]);
    for (const m of mods ?? []) totalMod.set(m.deliverable_id, (totalMod.get(m.deliverable_id) ?? 0) + 1);
    for (const p of prog ?? []) feitosMod.set(p.deliverable_id, (feitosMod.get(p.deliverable_id) ?? 0) + 1);
  }

  return (
    <ContentArea>
      <PageHeader eyebrow="Minhas entregas" title="O que a Salestrack já entregou"
        subtitle="Cursos, vídeos, documentos e mais — acesse e acompanhe no seu ritmo." />

      {dels.length === 0 ? (
        <Card><EmptyState icon={<Icon name="fileText" size={22} />} title="Nada por aqui ainda" description="Assim que a Salestrack liberar uma entrega, ela aparece aqui para você acessar." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dels.map((d) => {
            const def = tipoDef(d.kind);
            const passo = isPassoAPasso(d.kind);
            const pct = passo ? progressoModulos(totalMod.get(d.id) ?? 0, feitosMod.get(d.id) ?? 0) : null;
            const url = d.public_token ? `/entregavel/${d.public_token}` : d.external_url;
            return (
              <Card key={d.id} className="flex flex-col justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone="brand">{def.label}</Badge>
                    <span className="font-montserrat text-[13px] text-[color:var(--fg-4)]">{familiaLabel(def.familia)}</span>
                  </div>
                  <p className="font-montserrat text-[16px] font-semibold text-[color:var(--fg-1)]">{d.title}</p>
                  {pct !== null && (
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between font-montserrat text-[13px] text-[color:var(--fg-3)]"><span>Seu progresso</span><span>{pct}%</span></div>
                      <div className="h-2 w-full rounded-full bg-[var(--bg-2)]"><div className="h-2 rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {url
                    ? <a href={url} target={d.public_token ? "_self" : "_blank"} rel="noopener noreferrer" className={botaoClasses()}><Icon name="activity" size={14} /> {passo ? (pct && pct > 0 ? "Continuar" : "Começar") : "Acessar"}</a>
                    : <span className="font-montserrat text-[13px] text-[color:var(--fg-4)]">em preparação</span>}
                  <form action={aceitarEntregaAction.bind(null, d.id)}>
                    <button className="ds-focus inline-flex h-10 items-center rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Aprovar entrega</button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </ContentArea>
  );
}
