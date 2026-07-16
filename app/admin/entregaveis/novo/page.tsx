/** Novo entregável (UC) — escolhe o tipo (por família), IA rascunha; passo a passo gera módulos. */
import Link from "next/link";
import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createClient } from "@/lib/supabase/server";
import { tiposPorFamilia, tipoSugeridoPorEtapa, STAGE_HINT } from "@/lib/estudio/catalogo";
import { criarEntregavelCatalogoAction } from "./actions";

export const dynamic = "force-dynamic";

const input = "h-11 w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[14px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]";
const lbl = "mb-1 block font-montserrat text-[13px] font-medium text-[color:var(--fg-2)]";

export default async function NovoEntregavel({ searchParams }: { searchParams: Promise<{ cliente?: string; etapa?: string }> }) {
  const sp = await searchParams;
  const etapa = Math.max(1, Math.min(6, Number(sp.etapa ?? 3)));
  const kindSugerido = tipoSugeridoPorEtapa(etapa);
  const familias = tiposPorFamilia();

  const sb = await createClient();
  const { data: orgs } = await sb.from("organizations").select("id, name").eq("is_salestrack", false).order("name");
  const clientePre = sp.cliente && (orgs ?? []).some((o) => o.id === sp.cliente) ? sp.cliente : "";

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Estúdio", href: "/admin/entregaveis" }, { label: "Novo entregável" }]} className="mb-4" />
      <PageHeader eyebrow="Estúdio" title="Novo entregável"
        subtitle="Escolha o formato — curso, vídeo, podcast, planilha, app… A IA rascunha e você aprova. Passo a passo já vem com módulos."
        actions={<Link href="/admin/entregaveis" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Voltar ao Estúdio</Link>} />

      <div className="mx-auto mt-2 max-w-xl rounded-ds-card border border-hairline bg-[var(--bg-1)] p-6 shadow-ds-card sm:p-8">
        <form action={criarEntregavelCatalogoAction} className="space-y-5">
          <div>
            <label className={lbl} htmlFor="cliente">Cliente *</label>
            <select id="cliente" name="cliente" required defaultValue={clientePre} className={input}>
              <option value="" disabled>Selecione o cliente</option>
              {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="kind">Tipo de entregável *</label>
            <select id="kind" name="kind" defaultValue={kindSugerido} className={input}>
              {familias.map((f) => (
                <optgroup key={f.familia} label={f.label}>
                  {f.tipos.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 font-montserrat text-[11px] text-[color:var(--fg-4)]">Passo a passo (curso, treinamento, trilha, workshop, playbook) já cria os módulos.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className={lbl} htmlFor="titulo">Título</label><input id="titulo" name="titulo" placeholder="Ex.: Curso — Agente de IA na recepção" className={input} /></div>
            <div>
              <label className={lbl} htmlFor="etapa">Etapa da jornada</label>
              <select id="etapa" name="etapa" defaultValue={String(etapa)} className={input}>
                {[1, 2, 3, 4, 5, 6].map((e) => <option key={e} value={e}>{e} · {STAGE_HINT[e]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl} htmlFor="external_url">Link externo <span className="text-[color:var(--fg-4)]">(app, planilha, site, vídeo… opcional)</span></label>
            <input id="external_url" name="external_url" placeholder="https://…" className={input} />
          </div>
          <label className="flex items-center gap-2 font-montserrat text-[13px] text-[color:var(--fg-2)]">
            <input type="checkbox" name="gerar_ia" defaultChecked className="h-4 w-4 accent-[var(--brand)]" /> Rascunhar com IA (conteúdo / índice de módulos)
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button className="ds-focus inline-flex h-11 items-center rounded-ds-input bg-brand px-6 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Criar entregável</button>
            <span className="font-montserrat text-[11px] text-[color:var(--fg-4)]">Fica em rascunho até você aprovar. Aprovado → compartilhável por link.</span>
          </div>
        </form>
      </div>
    </ContentArea>
  );
}
