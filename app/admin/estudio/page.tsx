import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  PERFIL_LABELS, NIVEL_LABELS, MARCA_LABELS, MODALIDADE_LABELS,
  type PlaybookTrilha, type PlaybookRecipe, type SessionCatalog,
} from "@/lib/types";
import { toggleRecipePublished, deleteRecipe, saveTrilha, saveCatalog, saveAgentPrompt, setPromptActive, generateRecipeByAi } from "./actions";
import { Icon } from "@/components/ui/icons";
import { PageHeader, ContentArea } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";

export const dynamic = "force-dynamic";

type AgentPrompt = { id: string; agent_key: string; versao: number; system_prompt: string; ativo: boolean; created_at: string };

export default async function EstudioPage() {
  const supabase = await createClient();
  const [{ data: trilhas }, { data: recipes }, { data: catalog }, { data: prompts }, { data: convs }] = await Promise.all([
    supabase.from("playbook_trilhas").select("*").order("ordem"),
    supabase.from("playbook_recipes").select("*").order("ordem"),
    supabase.from("session_catalog").select("*").order("marca").order("titulo"),
    supabase.from("agent_prompts").select("*").order("agent_key").order("versao", { ascending: false }),
    supabase.from("conversations").select("agent_key"),
  ]);
  const trList = (trilhas as PlaybookTrilha[]) ?? [];
  const recList = (recipes as PlaybookRecipe[]) ?? [];
  const catList = (catalog as SessionCatalog[]) ?? [];
  const promptList = (prompts as AgentPrompt[]) ?? [];
  const convCount: Record<string, number> = {};
  for (const c of convs ?? []) convCount[c.agent_key] = (convCount[c.agent_key] ?? 0) + 1;
  const AGENTS = [
    { key: "consultor_programa", nome: "Consultor do Programa" },
    { key: "agente_sucesso", nome: "Agente de Sucesso" },
    { key: "prospect_intel", nome: "Prospecção · Inteligência (dossiê)" },
    { key: "prospect_writer", nome: "Prospecção · Redação (toques)" },
    { key: "prospect_classifier", nome: "Prospecção · Classificação de respostas" },
    { key: "copilot_admin", nome: "Copiloto (IA em toda a plataforma)" },
  ];
  const published = recList.filter((r) => r.published).length;
  const review = recList.filter((r) => r.needs_review).length;

  const perfilOpts = ["operacional", "gestor", "clevel"];
  const nivelOpts = ["iniciante", "intermediario", "avancado"];
  const marcaOpts = ["AK", "ST"];
  const modOpts = ["online", "in_loco", "hibrido"];

  return (
    <ContentArea>
      <div className="space-y-10">
        <div>
          <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Método", href: "/admin/metodo" }, { label: "Estúdio do Método" }]} className="mb-4" />
          <PageHeader eyebrow="Método" title="Estúdio do Método"
            subtitle="Edite as Receitas do Playbook e o catálogo de Sessões ao Vivo."
            comoUsar={<HelpButton routeKey="/admin/metodo" />}
            actions={<Link href="/admin/estudio/receita/novo" className="btn-gold text-sm whitespace-nowrap">+ Nova receita</Link>} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="card p-6"><p className="label">Receitas</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{recList.length}</p></div>
          <div className="card p-6"><p className="label">Publicadas</p><p className="font-serif text-3xl font-semibold text-gold mt-1">{published}</p></div>
          <div className="card p-6"><p className="label">A revisar (ganho)</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{review}</p></div>
          <div className="card p-6"><p className="label">Trilhas</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{trList.length}</p></div>
        </div>

        {/* Criar receita por IA */}
        <div className="card p-6 border-goldline bg-[rgba(0, 122, 148,.04)]">
          <div className="flex items-center gap-2 mb-3"><span className="text-gold"><Icon name="sparkles" size={16} /></span><h2 className="font-serif text-lg font-semibold">Criar receita por IA</h2></div>
          <form action={generateRecipeByAi} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-64"><label className="label">Tema da receita</label><input name="tema" required className="input w-full" placeholder="Ex.: Preparar uma reunião de diretoria com IA" /></div>
            <div className="w-44"><label className="label">Perfil</label><select name="perfil" className="input w-full" defaultValue="operacional">{perfilOpts.map((p) => <option key={p} value={p}>{PERFIL_LABELS[p]}</option>)}</select></div>
            <div className="w-48"><label className="label">Trilha</label><select name="trilha_id" className="input w-full"><option value="">— sem trilha —</option>{trList.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}</select></div>
            <button className="btn-gold">Gerar rascunho</button>
          </form>
          <p className="text-[13px] text-muted2 mt-2">A IA gera título, passos e prompt pronto; salva como rascunho (não publicado) e abre para você revisar.</p>
        </div>

        {/* Receitas por trilha */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-4">Receitas</h2>
          <div className="space-y-6">
            {trList.map((t) => {
              const items = recList.filter((r) => r.trilha_id === t.id);
              return (
                <div key={t.id} className="card overflow-x-auto">
                  <div className="px-5 py-3 border-b border-line flex items-center justify-between">
                    <p className="font-serif text-lg font-semibold">{t.titulo} <span className="text-muted2 text-sm font-sans">· {PERFIL_LABELS[t.perfil] ?? t.perfil}</span></p>
                    <span className="text-xs text-muted2">{items.length} receitas</span>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {items.map((r) => (
                        <tr key={r.id} className="hover:bg-navy3/50 border-b border-line last:border-0">
                          <td className="td text-cream">{r.titulo}</td>
                          <td className="td text-xs text-muted2">{r.frente} · {NIVEL_LABELS[r.nivel] ?? r.nivel}</td>
                          <td className="td">{r.needs_review && <span className="badge-gold">revisar</span>}</td>
                          <td className="td">{r.published ? <span className="badge-teal">Publicada</span> : <span className="badge-muted">Rascunho</span>}</td>
                          <td className="td text-right whitespace-nowrap">
                            <form action={toggleRecipePublished.bind(null, r.id, !r.published)} className="inline"><button className="text-muted2 hover:text-gold text-xs mr-3">{r.published ? "Despublicar" : "Publicar"}</button></form>
                            <Link href={`/admin/estudio/receita/${r.id}`} className="text-gold text-sm hover:underline mr-3">Editar</Link>
                            <form action={deleteRecipe.bind(null, r.id)} className="inline"><button className="text-red-400/70 hover:text-red-400 text-xs">Excluir</button></form>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && <tr><td className="td text-muted2" colSpan={5}>Nenhuma receita nesta trilha.</td></tr>}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {/* Receitas sem trilha */}
            {recList.filter((r) => !r.trilha_id).length > 0 && (
              <div className="card overflow-x-auto">
                <div className="px-5 py-3 border-b border-line"><p className="font-serif text-lg font-semibold">Sem trilha</p></div>
                <table className="w-full"><tbody>
                  {recList.filter((r) => !r.trilha_id).map((r) => (
                    <tr key={r.id} className="hover:bg-navy3/50 border-b border-line last:border-0">
                      <td className="td text-cream">{r.titulo}</td>
                      <td className="td">{r.published ? <span className="badge-teal">Publicada</span> : <span className="badge-muted">Rascunho</span>}</td>
                      <td className="td text-right"><Link href={`/admin/estudio/receita/${r.id}`} className="text-gold text-sm hover:underline">Editar</Link></td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )}
          </div>
        </section>

        {/* Trilhas */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-4">Trilhas</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {trList.map((t) => (
              <details key={t.id} className="card p-5">
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <span className="font-serif text-base font-semibold">{t.titulo}</span>
                  <span className="badge-muted">{PERFIL_LABELS[t.perfil] ?? t.perfil}</span>
                </summary>
                <form action={saveTrilha} className="mt-4 space-y-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input name="titulo" defaultValue={t.titulo} className="input w-full text-sm" placeholder="Título" />
                  <textarea name="descricao" defaultValue={t.descricao ?? ""} rows={2} className="input w-full text-sm" placeholder="Descrição" />
                  <div className="flex gap-2">
                    <select name="perfil" defaultValue={t.perfil} className="input text-sm flex-1">{perfilOpts.map((p) => <option key={p} value={p}>{PERFIL_LABELS[p]}</option>)}</select>
                    <input name="ordem" type="number" defaultValue={t.ordem} className="input text-sm w-20" placeholder="Ordem" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="published" defaultChecked={t.published} /> Publicada</label>
                  <button className="btn-ghost text-xs">Salvar</button>
                </form>
              </details>
            ))}
            <details className="card p-5 border-goldline">
              <summary className="cursor-pointer list-none font-serif text-base font-semibold text-gold">+ Nova trilha</summary>
              <form action={saveTrilha} className="mt-4 space-y-2">
                <input name="titulo" className="input w-full text-sm" placeholder="Título" />
                <textarea name="descricao" rows={2} className="input w-full text-sm" placeholder="Descrição" />
                <div className="flex gap-2">
                  <select name="perfil" className="input text-sm flex-1">{perfilOpts.map((p) => <option key={p} value={p}>{PERFIL_LABELS[p]}</option>)}</select>
                  <input name="ordem" type="number" defaultValue={0} className="input text-sm w-20" placeholder="Ordem" />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="published" defaultChecked /> Publicada</label>
                <button className="btn-gold text-xs">Criar</button>
              </form>
            </details>
          </div>
        </section>

        {/* Catálogo de sessões */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-4">Catálogo de Sessões</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catList.map((c) => (
              <details key={c.id} className="card p-5">
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <span className="font-serif text-base font-semibold">{c.titulo}</span>
                  <span className="badge-muted">{MARCA_LABELS[c.marca] ?? c.marca}</span>
                </summary>
                <form action={saveCatalog} className="mt-4 space-y-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="titulo" defaultValue={c.titulo} className="input w-full text-sm" placeholder="Título" />
                  <textarea name="descricao" defaultValue={c.descricao ?? ""} rows={2} className="input w-full text-sm" placeholder="Descrição" />
                  <div className="flex gap-2">
                    <select name="marca" defaultValue={c.marca} className="input text-sm flex-1">{marcaOpts.map((x) => <option key={x} value={x}>{MARCA_LABELS[x]}</option>)}</select>
                    <select name="modalidade" defaultValue={c.modalidade} className="input text-sm flex-1">{modOpts.map((x) => <option key={x} value={x}>{MODALIDADE_LABELS[x]}</option>)}</select>
                  </div>
                  <div className="flex gap-2">
                    <input name="duracao_min" type="number" defaultValue={c.duracao_min ?? ""} className="input text-sm w-28" placeholder="min" />
                    <input name="calendly_url" defaultValue={c.calendly_url ?? ""} className="input text-sm flex-1" placeholder="Calendly URL" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="published" defaultChecked={c.published} /> Publicada no portal</label>
                  <button className="btn-ghost text-xs">Salvar</button>
                </form>
              </details>
            ))}
            <details className="card p-5 border-goldline">
              <summary className="cursor-pointer list-none font-serif text-base font-semibold text-gold">+ Nova sessão</summary>
              <form action={saveCatalog} className="mt-4 space-y-2">
                <input name="titulo" className="input w-full text-sm" placeholder="Título" />
                <textarea name="descricao" rows={2} className="input w-full text-sm" placeholder="Descrição" />
                <div className="flex gap-2">
                  <select name="marca" className="input text-sm flex-1">{marcaOpts.map((x) => <option key={x} value={x}>{MARCA_LABELS[x]}</option>)}</select>
                  <select name="modalidade" className="input text-sm flex-1">{modOpts.map((x) => <option key={x} value={x}>{MODALIDADE_LABELS[x]}</option>)}</select>
                </div>
                <div className="flex gap-2">
                  <input name="duracao_min" type="number" className="input text-sm w-28" placeholder="min" />
                  <input name="calendly_url" className="input text-sm flex-1" placeholder="Calendly URL" />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="published" /> Publicada no portal</label>
                <button className="btn-gold text-xs">Criar</button>
              </form>
            </details>
          </div>
        </section>

        {/* Agentes internos (prompts versionados) */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-1">Agentes internos</h2>
          <p className="text-sm text-muted2 mb-4">System prompts versionados do Consultor e do Agente de Sucesso. A versão ativa é a que responde. Guardrails de escopo e isolamento são sempre aplicados por cima, no servidor.</p>
          <div className="space-y-5">
            {AGENTS.map((a) => {
              const versions = promptList.filter((p) => p.agent_key === a.key);
              const ativa = versions.find((p) => p.ativo);
              return (
                <div key={a.key} className="card p-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-serif text-lg font-semibold">{a.nome}</h3>
                    <span className="text-xs text-muted2">{convCount[a.key] ?? 0} conversa(s) · v.ativa {ativa?.versao ?? "—"}</span>
                  </div>
                  {versions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {versions.map((p) => (
                        <form key={p.id} action={setPromptActive.bind(null, p.id, a.key)}>
                          <button className={p.ativo ? "badge-teal" : "badge-muted hover:!text-gold"} title={p.system_prompt.slice(0, 200)}>v{p.versao}{p.ativo ? " · ativa" : ""}</button>
                        </form>
                      ))}
                    </div>
                  )}
                  <details>
                    <summary className="cursor-pointer text-sm text-gold">+ Nova versão do prompt</summary>
                    <form action={saveAgentPrompt.bind(null, a.key)} className="mt-3 space-y-2">
                      <textarea name="system_prompt" rows={5} className="input w-full text-sm" placeholder="System prompt…" defaultValue={ativa?.system_prompt ?? ""} />
                      <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="ativar" defaultChecked /> Ativar esta versão</label>
                      <button className="btn-gold text-xs">Salvar versão</button>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </ContentArea>
  );
}
