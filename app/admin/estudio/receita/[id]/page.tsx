import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERFIL_LABELS, type PlaybookTrilha, type PlaybookRecipe } from "@/lib/types";
import { saveRecipe } from "../../actions";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

export default async function RecipeEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "novo";
  const supabase = await createClient();
  const [{ data: trilhas }, recRes] = await Promise.all([
    supabase.from("playbook_trilhas").select("*").order("ordem"),
    isNew ? Promise.resolve({ data: null }) : supabase.from("playbook_recipes").select("*").eq("id", id).single(),
  ]);
  const trList = (trilhas as PlaybookTrilha[]) ?? [];
  const r = (recRes.data as PlaybookRecipe | null) ?? null;
  if (!isNew && !r) notFound();
  const passosText = Array.isArray(r?.passos) ? (r!.passos as string[]).join("\n") : "";

  const perfilOpts = ["operacional", "gestor", "clevel"];
  const nivelOpts = [["iniciante", "Iniciante"], ["intermediario", "Intermediário"], ["avancado", "Avançado"]];

  return (
    <ContentArea>
      <div className="max-w-3xl">
        <Link href="/admin/estudio" className="text-sm text-muted2 hover:text-gold">← Estúdio do Método</Link>
        <h1 className="font-serif text-3xl font-semibold mt-2 mb-6">{isNew ? "Nova receita" : "Editar receita"}</h1>

        <form action={saveRecipe.bind(null, isNew ? null : id)} className="space-y-5">
          <div>
            <label className="label mb-1 block">Título</label>
            <input name="titulo" defaultValue={r?.titulo ?? ""} required className="input w-full" placeholder="Ex.: Resumir um documento longo em pontos de decisão" />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label mb-1 block">Trilha</label>
              <select name="trilha_id" defaultValue={r?.trilha_id ?? ""} className="input w-full">
                <option value="">— sem trilha —</option>
                {trList.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            </div>
            <div>
              <label className="label mb-1 block">Perfil</label>
              <select name="perfil" defaultValue={r?.perfil ?? "operacional"} className="input w-full">{perfilOpts.map((p) => <option key={p} value={p}>{PERFIL_LABELS[p]}</option>)}</select>
            </div>
            <div>
              <label className="label mb-1 block">Nível</label>
              <select name="nivel" defaultValue={r?.nivel ?? "iniciante"} className="input w-full">{nivelOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="label mb-1 block">Frente</label><input name="frente" defaultValue={r?.frente ?? ""} className="input w-full" placeholder="Comunicação" /></div>
            <div><label className="label mb-1 block">Tempo (min)</label><input name="tempo_min" type="number" defaultValue={r?.tempo_min ?? ""} className="input w-full" /></div>
            <div><label className="label mb-1 block">Ordem</label><input name="ordem" type="number" defaultValue={r?.ordem ?? 0} className="input w-full" /></div>
          </div>

          <div><label className="label mb-1 block">O quê</label><textarea name="oque" defaultValue={r?.oque ?? ""} rows={2} className="input w-full" /></div>
          <div><label className="label mb-1 block">Por quê</label><textarea name="porque" defaultValue={r?.porque ?? ""} rows={2} className="input w-full" /></div>
          <div><label className="label mb-1 block">Ganho estimado</label><input name="ganho" defaultValue={r?.ganho ?? ""} className="input w-full" /></div>

          <div>
            <label className="label mb-1 block">Passos (um por linha)</label>
            <textarea name="passos" defaultValue={passosText} rows={6} className="input w-full font-mono text-sm" placeholder={"Abra uma conversa nova no seu Claude.\nArraste o documento..."} />
          </div>

          <div>
            <label className="label mb-1 block">Prompt pronto</label>
            <textarea name="prompt_pronto" defaultValue={r?.prompt_pronto ?? ""} rows={5} className="input w-full text-sm" />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="published" defaultChecked={r?.published ?? true} /> Publicada</label>
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="needs_review" defaultChecked={r?.needs_review ?? false} /> Marcar para revisão (ganho)</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-gold">Salvar</button>
            <Link href="/admin/estudio" className="btn-ghost">Cancelar</Link>
          </div>
        </form>
      </div>
    </ContentArea>
  );
}
