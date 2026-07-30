import { createClient } from "@/lib/supabase/server";
import { ContentArea, PageHeader, Card, Badge, EmptyState, Input, Select, botaoClasses } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { HelpButton } from "@/components/guidance/HelpButton";
import { AI_METHOD } from "@/lib/ds/method";
import { gatilhoLabel, EVENTOS, type Gatilho } from "@/lib/comms/triggers";
import { ASSET_TYPES, assetTypeLabel, stepCompleteness, type ReguaStep } from "@/lib/comms/regua";
import { seedDefaultTemplateAction, addStepAction, toggleStepAction, removeStepAction, bindAssetAction, aprovarEnvioAction, cancelarItemAction, retryEnvioAction } from "./actions";

export const dynamic = "force-dynamic";
const lbl = "mb-1.5 block font-montserrat text-[13px] font-medium text-[color:var(--fg-2)]";

type Step = ReguaStep & { id: string; asset_ref: string | null; ativo: boolean };
type Asset = { id: string; title: string; line: string; status: string; comm_eligible: boolean | null };

export default async function ComunicacaoPage() {
  const sb = await createClient();
  const { data: regua } = await sb.from("regua").select("id, nome").eq("scope", "program_template").is("deleted_at", null).order("created_at").limit(1).maybeSingle();
  const [{ data: stepsRaw }, { data: assetsRaw }, { data: queueRaw }, { data: projs }] = await Promise.all([
    regua ? sb.from("regua_step").select("id, cycle_step, titulo, gatilho, asset_type, asset_ref, publico, ativo, ordem").eq("regua_id", regua.id).is("deleted_at", null).order("cycle_step").order("ordem") : Promise.resolve({ data: [] }),
    sb.from("studio_deliverables").select("id, title, line, status, comm_eligible").in("status", ["aprovado", "publicado", "entregue"]).is("deleted_at", null).limit(300),
    sb.from("comm_queue").select("id, program_id, canal, recipient, status, erro, tentativas, created_at").order("created_at", { ascending: false }).limit(40),
    sb.from("projects").select("id, name").is("deleted_at", null).limit(500),
  ]);
  const projName: Record<string, string> = Object.fromEntries((projs ?? []).map((p) => [p.id, p.name]));
  const queue = (queueRaw ?? []) as { id: string; program_id: string; canal: string; recipient: { nome?: string; email?: string; phone?: string }; status: string; erro: string | null; tentativas: number }[];
  const aguardando = queue.filter((q) => q.status === "aguardando_aprovacao");
  const historico = queue.filter((q) => q.status !== "aguardando_aprovacao").slice(0, 10);
  const steps = (stepsRaw ?? []) as Step[];
  const assets = (assetsRaw ?? []) as Asset[];
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const completos = steps.filter((s) => stepCompleteness(s, assetById.get(s.asset_ref ?? "")).status === "completo").length;

  if (!regua) {
    return (
      <ContentArea>
        <Breadcrumbs items={[{ label: "Comunicação", href: "/admin/comunicacao" }, { label: "Régua" }]} className="mb-4" />
        <PageHeader eyebrow="Comunicação · Régua" title="O motor que conduz" subtitle="A régua define o que comunicar, por qual gatilho e quando — ao longo do ciclo do método, consumindo ativos aprovados do Estúdio." />
        <EmptyState icon={<Icon name="sparkles" size={22} />} title="Nenhuma régua ainda" description="Crie a régua-template padrão (engajamento AI Operating System) para começar a desenhar a jornada de comunicação." guiaHref="/admin/ajuda"
          action={<form action={seedDefaultTemplateAction}><button className={botaoClasses()}><Icon name="sparkles" size={15} /> Criar régua padrão</button></form>} />
      </ContentArea>
    );
  }

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Comunicação", href: "/admin/comunicacao" }, { label: regua.nome }]} className="mb-4" />
      <PageHeader eyebrow="Comunicação · Régua-template" title={regua.nome}
        subtitle="Cada passo conduz o cliente numa fase do programa. Só dispara quando tem um material do Estúdio aprovado."
        comoUsar={<HelpButton routeKey="/admin/comunicacao" />}
        actions={<Badge tone={completos === steps.length && steps.length > 0 ? "success" : "warn"}>{completos}/{steps.length} passos completos</Badge>} />

      {/* Fila de envio — supervisão humana por padrão (R4.3) */}
      <Card bloom className="mb-6">
        <div className="mb-3 flex items-center gap-2"><Icon name="chat" size={17} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Fila de envio · aprovação</p><Badge tone={aguardando.length ? "warn" : "neutral"}>{aguardando.length}</Badge></div>
        {aguardando.length === 0 ? (
          <p className="ds-small">Nada aguardando aprovação. Quando um passo da régua chega na hora (e o material está aprovado), a comunicação cai aqui para você aprovar antes de sair. Por padrão, nada é enviado sem a sua aprovação.</p>
        ) : (
          <ul className="space-y-2">
            {aguardando.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-hairline bg-[var(--bg-2)] px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-montserrat text-[14px] text-[color:var(--fg-1)]">{projName[q.program_id] ?? "Programa"} · {q.canal}</p>
                  <p className="ds-small !mt-0.5">para {q.recipient?.nome ?? q.recipient?.email ?? q.recipient?.phone ?? "destinatário"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={aprovarEnvioAction.bind(null, q.id)}><button className={botaoClasses({ size: "sm" })}>Aprovar envio</button></form>
                  <form action={cancelarItemAction.bind(null, q.id)}><button className="ds-focus rounded-ds-input border border-hairline-strong px-2.5 py-1.5 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-1)]">Cancelar</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {historico.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-3 space-y-1.5">
            <p className="ds-small !mt-0 font-medium text-[color:var(--fg-2)]">Histórico recente</p>
            {historico.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-2">
                <span className="ds-small !mt-0 truncate">{projName[q.program_id] ?? "Programa"} · {q.canal} · {q.recipient?.nome ?? q.recipient?.email ?? q.recipient?.phone ?? "—"}</span>
                <div className="flex items-center gap-2">
                  <Badge tone={q.status === "enviado" ? "success" : q.status === "falhou" ? "danger" : "neutral"}>{q.status}</Badge>
                  {q.status === "falhou" && q.tentativas < 3 && <form action={retryEnvioAction.bind(null, q.id)}><button className="ds-focus rounded-ds-input border border-hairline-strong px-2 py-0.5 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Retry</button></form>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {AI_METHOD.map((phase, ci) => {
        const stepsOfPhase = steps.filter((s) => s.cycle_step === ci);
        return (
          <section key={ci} className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tile)] font-jbmono text-[13px] text-[color:var(--brand)]">{ci + 1}</span>
              <p className="font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">{phase.title}</p>
              <span className="ds-small !mt-0">· {phase.objective}</span>
            </div>
            {stepsOfPhase.length === 0 ? (
              <p className="ds-small ml-8 mb-2">Nenhum passo nesta fase.</p>
            ) : (
              <div className="ml-8 space-y-2">
                {stepsOfPhase.map((s) => {
                  const comp = stepCompleteness(s, assetById.get(s.asset_ref ?? ""));
                  const opts = assets.filter((a) => (ASSET_TYPES.find((t) => t.key === s.asset_type)?.lines ?? []).includes(a.line));
                  return (
                    <div key={s.id} className={`rounded-ds-card border p-4 ${s.ativo ? "border-hairline bg-[var(--bg-1)]" : "border-dashed border-hairline bg-[var(--bg-1)]/60 opacity-70"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-montserrat text-[14px] font-semibold text-[color:var(--fg-1)]">{s.titulo}</p>
                          <p className="ds-small !mt-0.5">{gatilhoLabel(s.gatilho as Gatilho)} · material: <b className="text-[color:var(--fg-2)]">{assetTypeLabel(s.asset_type)}</b> · para {s.publico}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={comp.status === "completo" ? "success" : "warn"}>{comp.status === "completo" ? "completo" : "incompleto"}</Badge>
                          <form action={toggleStepAction.bind(null, s.id, !s.ativo)}><button className="ds-focus rounded-ds-input border border-hairline-strong px-2.5 py-1 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">{s.ativo ? "Desativar" : "Ativar"}</button></form>
                          <form action={removeStepAction.bind(null, s.id)}><button className="ds-focus rounded-ds-input border border-hairline-strong px-2.5 py-1 font-montserrat text-[13px] text-[color:var(--fg-3)] hover:bg-[var(--bg-2)]">Remover</button></form>
                        </div>
                      </div>
                      <form action={bindAssetAction.bind(null, s.id)} className="mt-3 flex items-center gap-2">
                        <select name="asset_ref" defaultValue={s.asset_ref ?? ""} className="h-9 flex-1 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-2 font-montserrat text-[13px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]">
                          <option value="">— vincular material aprovado ({assetTypeLabel(s.asset_type)}) —</option>
                          {opts.map((a) => <option key={a.id} value={a.id}>{a.title} [{a.status}]</option>)}
                        </select>
                        <button className="ds-focus rounded-ds-input border border-hairline-strong px-3 py-1.5 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Vincular</button>
                      </form>
                      {comp.motivo && comp.status === "incompleto" && <p className="ds-small !mt-2 text-[color:var(--warn)]">{comp.motivo} Um passo incompleto nunca dispara.</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {/* Adicionar passo — recolhido por padrão (tela mínima) */}
      <Card className="mt-6">
        <details>
          <summary className="ds-focus flex cursor-pointer list-none items-center gap-2 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">
            <Icon name="pen" size={15} className="text-[color:var(--brand)]" /> Adicionar um passo
            <span className="ds-small !mt-0 ml-1 font-normal">(clique para abrir)</span>
          </summary>
          <form action={addStepAction.bind(null, regua.id)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Título</label><Input name="titulo" placeholder="Ex.: Aviso de novo material" required /></div>
          <div><label className={lbl}>Fase do ciclo</label><Select name="cycle_step" defaultValue="0">{AI_METHOD.map((p, i) => <option key={i} value={i}>{i + 1}. {p.title}</option>)}</Select></div>
          <div><label className={lbl}>Tipo de material</label><Select name="asset_type" defaultValue="email">{ASSET_TYPES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</Select></div>
          <div><label className={lbl}>Público</label><Select name="publico" defaultValue="cliente"><option value="cliente">Cliente</option><option value="equipe_cliente">Equipe do cliente</option><option value="admin">Admin</option></Select></div>
          <div><label className={lbl}>Gatilho</label><Select name="gatilho_tipo" defaultValue="tempo"><option value="tempo">Tempo</option><option value="evento">Evento</option><option value="estado">Estado</option></Select></div>
          <div><label className={lbl}>Parâmetro</label>
            <div className="grid grid-cols-3 gap-2">
              <Input name="g_offset" type="number" defaultValue="0" placeholder="dias (tempo)" />
              <Select name="g_evento" defaultValue="entregavel_aprovado">{EVENTOS.map((e) => <option key={e} value={e}>{e}</option>)}</Select>
              <Input name="g_dias" type="number" defaultValue="10" placeholder="dias (estado)" />
            </div>
            <input type="hidden" name="g_quando" value="apos_inicio_fase" /><input type="hidden" name="g_condicao" value="inatividade" />
          </div>
            <div className="sm:col-span-2"><button className={botaoClasses()}>Adicionar passo</button></div>
          </form>
        </details>
        <p className="ds-small mt-3">Aqui você só desenha a régua. O envio acontece na hora certa, sempre com a sua aprovação.</p>
      </Card>
    </ContentArea>
  );
}
