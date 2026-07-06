import Link from "next/link";
import { PageHeader } from "@/components/ds";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalOrg } from "@/lib/portal";
import { NIVEL_LABELS, type PlaybookTrilha, type PlaybookRecipe } from "@/lib/types";
import { NextRecipe } from "@/components/portal/NextRecipe";
import { anthropicConfigured } from "@/lib/agents/runner";
import { getOrgFeatures } from "@/lib/plans/features";
import { Upsell } from "@/components/portal/Upsell";

export const dynamic = "force-dynamic";

export default async function PlaybookHome() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  if (!m!.adminView && !(await getOrgFeatures(orgId)).playbook) return <Upsell feature="playbook" />;
  const supabase = await createClient();
  const [{ data: trilhas }, { data: recipes }, { data: progress }] = await Promise.all([
    supabase.from("playbook_trilhas").select("*").eq("published", true).order("ordem"),
    supabase.from("playbook_recipes").select("*").eq("published", true).order("ordem"),
    supabase.from("recipe_progress").select("recipe_id").eq("org_id", orgId).eq("status", "concluida"),
  ]);
  const done = new Set((progress ?? []).map((p) => p.recipe_id as string));
  const trList = (trilhas as PlaybookTrilha[]) ?? [];
  const recList = (recipes as PlaybookRecipe[]) ?? [];
  const totalDone = recList.filter((r) => done.has(r.id)).length;

  return (
    <div className="space-y-8">
      <div>
        <PageHeader eyebrow="Método · autossuficiente" title="Playbook" />
        <p className="text-sm text-muted mt-2 max-w-2xl">
          Receitas prontas para sua equipe aplicar IA no dia a dia. Cada uma é autossuficiente: leia aqui, execute no seu próprio Claude.
          Você marca como concluída para acompanhar a adoção — nada se conecta ao seu ambiente.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 rounded-full bg-navy3 overflow-hidden w-56"><div className="h-full bg-gold" style={{ width: `${recList.length ? (totalDone / recList.length) * 100 : 0}%` }} /></div>
          <span className="text-xs text-muted2 font-mono">{totalDone}/{recList.length} concluídas</span>
        </div>
      </div>

      {anthropicConfigured() && !m!.adminView && <NextRecipe />}

      {trList.map((t) => {
        const items = recList.filter((r) => r.trilha_id === t.id);
        if (items.length === 0) return null;
        const tDone = items.filter((r) => done.has(r.id)).length;
        return (
          <section key={t.id}>
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <div>
                <h2 className="font-serif text-2xl font-semibold">{t.titulo}</h2>
                {t.descricao && <p className="text-sm text-muted2 mt-0.5">{t.descricao}</p>}
              </div>
              <span className="text-xs text-muted2 font-mono whitespace-nowrap">{tDone}/{items.length}</span>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((r) => (
                <Link key={r.id} href={`/portal/playbook/${r.slug}`}
                  className="card p-5 hover:border-goldline transition-colors flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-[.14em] text-muted2">{r.frente}</span>
                    {done.has(r.id)
                      ? <span className="badge-teal">✓ Concluída</span>
                      : <span className="badge-muted">{r.tempo_min ? `${r.tempo_min} min` : ""}</span>}
                  </div>
                  <p className="font-serif text-lg font-semibold leading-snug">{r.titulo}</p>
                  <p className="text-sm text-muted mt-1.5 line-clamp-2 flex-1">{r.oque}</p>
                  <p className="text-[11px] text-muted2 mt-3">{NIVEL_LABELS[r.nivel] ?? r.nivel}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {recList.length === 0 && <div className="card p-8"><p className="text-sm text-muted2">O Playbook está sendo preparado.</p></div>}
    </div>
  );
}
