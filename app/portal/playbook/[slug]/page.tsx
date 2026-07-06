import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalOrg } from "@/lib/portal";
import { CopyButton } from "@/components/portal/CopyButton";
import { markRecipeDone, unmarkRecipe } from "../actions";
import { NIVEL_LABELS, type PlaybookRecipe } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  const supabase = await createClient();
  const { data } = await supabase.from("playbook_recipes").select("*").eq("slug", slug).eq("published", true).single();
  const r = data as PlaybookRecipe | null;
  if (!r) notFound();

  const { data: prog } = await supabase.from("recipe_progress").select("id").eq("org_id", orgId).eq("recipe_id", r.id).eq("status", "concluida").limit(1);
  const isDone = (prog?.length ?? 0) > 0;
  const passos = Array.isArray(r.passos) ? r.passos : [];

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/portal/playbook" className="text-sm text-muted2 hover:text-gold">← Playbook</Link>

      <div className="card p-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-[.14em] text-muted2">{r.frente}</span>
          <span className="badge-muted">{NIVEL_LABELS[r.nivel] ?? r.nivel}</span>
          {r.tempo_min && <span className="badge-muted">{r.tempo_min} min</span>}
          {isDone && <span className="badge-teal">✓ Concluída</span>}
        </div>
        <h1 className="font-serif text-3xl font-semibold leading-tight">{r.titulo}</h1>
        {r.oque && <p className="text-muted mt-3 leading-relaxed">{r.oque}</p>}

        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          {r.porque && <div className="bg-navy3 border border-line rounded-lg p-4"><p className="label mb-1">Por que fazer</p><p className="text-sm text-muted leading-relaxed">{r.porque}</p></div>}
          {r.ganho && <div className="bg-navy3 border border-line rounded-lg p-4"><p className="label mb-1">Ganho estimado</p><p className="text-sm text-muted leading-relaxed">{r.ganho}</p></div>}
        </div>
      </div>

      {passos.length > 0 && (
        <div className="card p-6">
          <p className="label mb-4">Passo a passo</p>
          <ol className="space-y-3">
            {passos.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[rgba(79, 31, 255,.14)] border border-goldline text-gold flex items-center justify-center font-mono text-xs">{i + 1}</span>
                <span className="text-sm text-cream leading-relaxed pt-0.5">{p}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {r.prompt_pronto && (
        <div className="card p-6 border-goldline">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="label">Prompt pronto</p>
            <CopyButton text={r.prompt_pronto} />
          </div>
          <pre className="text-sm text-cream whitespace-pre-wrap font-sans leading-relaxed bg-navy3 border border-line rounded-lg p-4">{r.prompt_pronto}</pre>
        </div>
      )}

      <div className="card p-6">
        {m!.adminView ? (
          <p className="text-sm text-muted2">Visão admin — a conclusão é registrada pelo cliente.</p>
        ) : isDone ? (
          <form action={unmarkRecipe.bind(null, r.id)} className="flex items-center justify-between gap-3">
            <p className="text-sm text-teal-300">✓ Sua equipe marcou esta receita como concluída.</p>
            <button className="btn-ghost text-xs">Desfazer</button>
          </form>
        ) : (
          <form action={markRecipeDone.bind(null, r.id)} className="space-y-3">
            <p className="text-sm text-muted">Aplicou esta receita? Marque como concluída para acompanhar a adoção do seu time.</p>
            <textarea name="feedback" rows={2} placeholder="Como foi? (opcional)" className="input w-full text-sm" />
            <button className="btn-gold text-sm">Marcar como concluída</button>
          </form>
        )}
      </div>
    </div>
  );
}
