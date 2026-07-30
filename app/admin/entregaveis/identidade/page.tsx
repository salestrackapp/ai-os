import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ACCENTS_PERMITIDOS, BRAND_LABELS } from "@/lib/deliverables/types";
import { ContentArea, PageHeader, Card, Badge, EmptyState, Input, Select, botaoClasses } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { HelpButton } from "@/components/guidance/HelpButton";
import { saveIdentityAction, activateIdentityAction } from "./actions";

export const dynamic = "force-dynamic";
const lbl = "mb-1.5 block font-montserrat text-[13px] font-medium text-[color:var(--fg-2)]";

type Idn = { id: string; program_id: string; program_name: string | null; cover_title: string | null; cover_subtitle: string | null; client_logo: string | null; brand_attribution: string; accent: string | null; status: string; active: boolean };

export default async function IdentidadePage() {
  const sb = await createClient();
  const [{ data: projects }, { data: orgs }, { data: idns }] = await Promise.all([
    sb.from("projects").select("id, name, org_id").is("deleted_at", null).order("created_at", { ascending: false }).limit(40),
    sb.from("organizations").select("id, name"),
    sb.from("programa_identidade").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
  ]);
  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  const byProgram = new Map<string, Idn[]>();
  for (const i of (idns ?? []) as Idn[]) { const a = byProgram.get(i.program_id) ?? []; a.push(i); byProgram.set(i.program_id, a); }

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Estúdio", href: "/admin/entregaveis" }, { label: "Identidade do programa" }]} className="mb-4" />
      <PageHeader eyebrow="Estúdio · Identidade" title="Identidade do programa"
        subtitle="Personalização leve dentro do design Salestrack AI v2: logo, nome, capa e um acento da paleta v2. Nunca um segundo design."
        comoUsar={<HelpButton routeKey="/admin/entregaveis/identidade" />} />

      {(projects ?? []).length === 0 ? (
        <EmptyState icon={<Icon name="gem" size={22} />} title="Nenhum programa ainda" description="Crie um programa para definir sua identidade de entrega." />
      ) : (
        <div className="space-y-4">
          {(projects ?? []).map((p) => {
            const list = byProgram.get(p.id) ?? [];
            const active = list.find((i) => i.active);
            const draft = list.find((i) => i.status !== "aprovado");
            const cur = draft ?? active ?? null;
            return (
              <Card key={p.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">{p.name}</p>
                    <p className="ds-small !mt-0.5">{orgName[p.org_id] ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {active && <Badge tone="success">Ativa · {BRAND_LABELS[active.brand_attribution] ?? active.brand_attribution}</Badge>}
                    {active?.accent && <span className="inline-block h-5 w-5 rounded-full border border-hairline" style={{ background: active.accent }} title={active.accent} />}
                    {draft && <Badge tone="warn">Rascunho</Badge>}
                  </div>
                </div>

                <form action={saveIdentityAction} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="program_id" value={p.id} />
                  <div><label className={lbl}>Nome do programa</label><Input name="program_name" defaultValue={cur?.program_name ?? p.name} /></div>
                  <div><label className={lbl}>Logo do cliente (URL)</label><Input name="client_logo" defaultValue={cur?.client_logo ?? ""} placeholder="https://…/logo.png" /></div>
                  <div><label className={lbl}>Título de capa</label><Input name="cover_title" defaultValue={cur?.cover_title ?? ""} placeholder="Ex.: Programa de IA" /></div>
                  <div><label className={lbl}>Subtítulo de capa</label><Input name="cover_subtitle" defaultValue={cur?.cover_subtitle ?? ""} /></div>
                  <div><label className={lbl}>Acento (paleta v2)</label>
                    <Select name="accent" defaultValue={cur?.accent ?? ""}>
                      <option value="">Violeta padrão</option>
                      {Object.entries(ACCENTS_PERMITIDOS).map(([name, hex]) => <option key={hex} value={hex}>{name} ({hex})</option>)}
                    </Select>
                  </div>
                  <div><label className={lbl}>Atribuição de marca (assinatura)</label>
                    <Select name="brand_attribution" defaultValue={cur?.brand_attribution ?? "salestrack"}>
                      <option value="salestrack">Salestrack AI</option>
                      <option value="andre_kachan">André Kachan</option>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <button type="submit" className="ds-focus inline-flex h-9 items-center rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)] hover:bg-[var(--bg-2)]">Salvar rascunho</button>
                    {draft && <button formAction={activateIdentityAction.bind(null, draft.id)} className={botaoClasses()}><Icon name="shield" size={14} /> Aprovar e ativar</button>}
                  </div>
                </form>
                {active && <p className="ds-small mt-2">Identidade ativa trava o conteúdo (imutável). Salvar cria um novo rascunho; aprovar substitui a ativa.</p>}
              </Card>
            );
          })}
        </div>
      )}

      <p className="ds-small mt-6"><Link href="/admin/entregaveis" className="text-[color:var(--brand)] hover:underline">← Voltar ao Estúdio</Link></p>
    </ContentArea>
  );
}
