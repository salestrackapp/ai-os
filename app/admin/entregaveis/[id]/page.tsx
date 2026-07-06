import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildDeliverableHtml } from "@/lib/deliverables/render/html";
import { KIND_LABELS, STATUS_LABELS, BRAND_LABELS, type BrandScope, type DeliverableContent, type DeliverableKind, type TenantBrand } from "@/lib/deliverables/types";
import { DownloadButton } from "@/components/deliverables/DownloadButton";
import { ContentArea, PageHeader, Card, Badge } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { statusAction, rerenderAction, saveContentAction, submitStudioAction, approveStudioAction, publishStudioAction, newVersionStudioAction, enviarPropostaAoComercialAction, gerarSlidesDaFormacaoAction, emitirCertificadoAction, gerarArteDoPostAction, baixarPngAction, dispararRenderVideoAction, enviarTesteAction } from "../actions";

const FORMACAO_TIPOS = ["palestra", "workshop", "treinamento", "curso"];
const CANAL_LINE: Record<string, "email" | "whatsapp"> = { email_mkt: "email", whatsapp: "whatsapp" };

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ST_TONE: Record<string, "neutral" | "brand" | "warn" | "success"> = {
  rascunho: "neutral", gerando: "brand", em_revisao: "warn", aprovado: "brand", entregue: "success", publicado: "success",
};
const BRAND_BG: Record<string, string> = { salestrack: "#0B0B16", andre_kachan: "#0F1A24", tenant: "#0F1A24" };

const btnPrimary = "ds-focus inline-flex h-9 items-center gap-1.5 rounded-ds-input bg-brand px-3.5 font-montserrat text-[13px] font-semibold text-white shadow-ds-brand transition-colors hover:bg-brand-hover";
const btnGhost = "ds-focus inline-flex h-9 items-center gap-1.5 rounded-ds-input border border-hairline-strong px-3.5 font-montserrat text-[13px] font-medium text-[color:var(--fg-2)] transition-colors hover:bg-[var(--bg-2)]";

export default async function DeliverableDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase.from("studio_deliverables").select("*").eq("id", id).maybeSingle();
  if (!d) notFound();

  const svc = createServiceClient();
  const [{ data: tpl }, { data: org }, { data: versions }, { data: deliveries }] = await Promise.all([
    svc.from("deliverable_templates").select("brand_scope, format, name").eq("key", d.template_key).maybeSingle(),
    svc.from("organizations").select("name").eq("id", d.org_id).maybeSingle(),
    svc.from("studio_deliverable_versions").select("version, created_at, rendered_url").eq("deliverable_id", id).order("version", { ascending: false }),
    svc.from("comms_delivery").select("canal, destinatario, status, erro, created_at").eq("deliverable_id", id).order("created_at", { ascending: false }).limit(8),
  ]);
  const canalDoAtivo = CANAL_LINE[d.line ?? ""];
  // R3.1: a MARCA do entregável manda (por linha); template é fallback. Padrão = Salestrack AI.
  const brand_scope = (d.brand ?? tpl?.brand_scope ?? "salestrack") as BrandScope;
  let branding: TenantBrand | null = null;
  if (brand_scope === "tenant") { const { data: b } = await svc.from("tenant_branding").select("internal_name, logo_url, color_primary, color_accent, color_bg, level").eq("org_id", d.org_id).maybeSingle(); branding = b ?? null; }

  const previewHtml = buildDeliverableHtml({ kind: d.kind as DeliverableKind, brand_scope, format: d.format, content: (d.content ?? { cover: { title: d.title } }) as DeliverableContent, branding, title: d.title });
  const isLocked = ["aprovado", "publicado", "entregue"].includes(d.status); // imutabilidade generalizada (R3.1)

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Estúdio", href: "/admin/entregaveis" }, { label: d.title }]} className="mb-4" />
      <PageHeader eyebrow="Entregável" title={d.title}
        subtitle={`${org?.name ?? "—"} · v${d.version} · ${String(d.format).toUpperCase()}`}
        actions={
          <div className="flex items-center gap-2">
            <form action={rerenderAction.bind(null, id)}><button className={btnGhost}>Re-renderizar</button></form>
            {d.rendered_url && <DownloadButton id={id} className={btnPrimary} />}
          </div>
        } />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={ST_TONE[d.status] ?? "neutral"}>{STATUS_LABELS[d.status] ?? d.status}</Badge>
        <Badge tone="neutral">{KIND_LABELS[d.kind as DeliverableKind]}</Badge>
        <Badge tone={brand_scope === "salestrack" ? "brand" : "neutral"}>{BRAND_LABELS[brand_scope]}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Preview */}
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <p className="ds-eyebrow !mb-0">Pré-visualização executiva</p>
            <span className="font-jbmono text-[11px] text-[color:var(--fg-4)]">{BRAND_LABELS[brand_scope]}</span>
          </div>
          <iframe srcDoc={previewHtml} className="w-full" style={{ height: 760, border: 0, background: BRAND_BG[brand_scope] ?? "#0F1A24" }} title="preview" />
        </Card>

        <div className="space-y-6">
          {/* Portão de aprovação */}
          <Card bloom>
            <div className="mb-2 flex items-center gap-2"><Icon name="shield" size={16} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Portão de aprovação</p></div>
            <p className="ds-small mb-4 !mt-0">A IA rascunha → <b className="text-[color:var(--fg-2)]">você aprova</b> → o sistema publica. Aprovado <b className="text-[color:var(--fg-2)]">trava o conteúdo</b> (só nova versão muda).</p>
            <div className="flex flex-wrap gap-2">
              {["rascunho", "gerando"].includes(d.status) && <form action={submitStudioAction.bind(null, id)}><button className={btnGhost}>Enviar p/ revisão</button></form>}
              {d.status === "em_revisao" && <><form action={approveStudioAction.bind(null, id)}><button className={btnPrimary}>Aprovar</button></form><form action={statusAction.bind(null, id, "rascunho")}><button className={btnGhost}>Voltar a rascunho</button></form></>}
              {d.status === "aprovado" && <><form action={publishStudioAction.bind(null, id)}><button className={btnPrimary}><Icon name="rocket" size={14} /> Publicar</button></form>{d.line === "proposta_doc" && <form action={enviarPropostaAoComercialAction.bind(null, id)}><button className={btnGhost}>Enviar ao Comercial</button></form>}<form action={statusAction.bind(null, id, "em_revisao")}><button className={btnGhost}>Reabrir revisão</button></form></>}
              {["publicado", "entregue"].includes(d.status) && <>
                <span className="inline-flex items-center gap-1.5 font-montserrat text-[13px] font-medium text-[color:var(--success)]">✓ {STATUS_LABELS[d.status]}{d.delivered_at ? ` · ${new Date(d.delivered_at).toLocaleDateString("pt-BR")}` : ""}</span>
                {d.public_token && <Link href={`/entregavel/${d.public_token}`} target="_blank" className={btnGhost}>Link público</Link>}
                <form action={newVersionStudioAction.bind(null, id)}><button className={btnGhost}>Nova versão</button></form>
              </>}
            </div>
          </Card>

          {/* Editor de conteúdo (travado após aprovação) */}
          <Card>
            <p className="mb-3 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Conteúdo</p>
            {isLocked ? (
              <div className="flex items-start gap-2.5 rounded-[10px] border border-[color:rgba(232,163,23,0.24)] bg-[var(--warn-tint)] px-4 py-3">
                <Icon name="lock" size={15} className="mt-0.5 text-[color:var(--warn)]" />
                <p className="ds-small !mt-0 text-[color:var(--fg-2)]">Entregável aprovado é <b>imutável</b> — só renderização/layout. Para mudar o conteúdo, crie uma <b>nova versão</b> no portão acima.</p>
              </div>
            ) : (
              <form action={saveContentAction.bind(null, id)} className="space-y-3">
                <div><label className="mb-1.5 block font-montserrat text-[12px] font-medium text-[color:var(--fg-2)]">Título</label><input name="title" defaultValue={d.title} className="h-10 w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-sm text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" /></div>
                <div><label className="mb-1.5 block font-montserrat text-[12px] font-medium text-[color:var(--fg-2)]">Conteúdo (JSON)</label><textarea name="content_json" rows={12} defaultValue={JSON.stringify(d.content, null, 2)} className="w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] p-3 font-jbmono text-[12px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" /></div>
                <button className={btnGhost}>Salvar e re-renderizar</button>
              </form>
            )}
          </Card>

          {/* Envio de teste por canal (R4.2) */}
          {canalDoAtivo && (
            <Card>
              <div className="mb-2 flex items-center gap-2"><Icon name="chat" size={16} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Enviar teste · {canalDoAtivo === "email" ? "E-mail" : "WhatsApp"}</p></div>
              <p className="ds-small mb-3 !mt-0">Os campos como {"{{"}nome{"}}"} são preenchidos <b>na hora do envio</b> com os dados reais — nunca ficam guardados na peça. Sem canal configurado, o texto fica pronto para envio manual.</p>
              {["aprovado", "publicado", "entregue"].includes(d.status) && d.comm_eligible ? (
                <form action={enviarTesteAction.bind(null, id)} className="space-y-2">
                  <input type="hidden" name="canal" value={canalDoAtivo} />
                  <div className="grid grid-cols-2 gap-2">
                    <input name="nome" aria-label="Nome do destinatário" placeholder="Nome" className="h-9 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[13px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
                    <input name="empresa" aria-label="Empresa do destinatário" placeholder="Empresa" className="h-9 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[13px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
                  </div>
                  {canalDoAtivo === "email"
                    ? <input name="email" type="email" aria-label="E-mail do destinatário" placeholder="E-mail do destinatário" required className="h-9 w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[13px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
                    : <input name="phone" aria-label="Telefone do destinatário" placeholder="Telefone (WhatsApp)" required className="h-9 w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[13px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />}
                  <label className="flex items-center gap-2 ds-small !mt-1"><input type="checkbox" name="opt_in" className="accent-[var(--brand)]" /> O destinatário concordou em receber por este canal</label>
                  <button className={btnPrimary}>Enviar teste</button>
                </form>
              ) : <p className="ds-small">Aprove o material para poder enviar.</p>}
              {(deliveries ?? []).length > 0 && (
                <div className="mt-4 border-t border-hairline pt-3 space-y-1.5">
                  <p className="ds-small !mt-0 font-medium text-[color:var(--fg-2)]">Registros de entrega</p>
                  {(deliveries ?? []).map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="ds-small !mt-0 truncate">{e.canal} · {e.destinatario}</span>
                      <Badge tone={e.status === "enviado" ? "success" : e.status === "bloqueado" || e.status === "falhou" ? "danger" : "warn"}>{e.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Vídeo (R3.8) */}
          {d.line === "video_roteiro" && (
            <Card>
              <div className="mb-2 flex items-center gap-2"><Icon name="eye" size={16} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Render de vídeo</p></div>
              <p className="ds-small mb-3 !mt-0">O storyboard já é entregável. O render final roda nas ferramentas de vídeo da Salestrack.</p>
              <div className="mb-3 flex items-center gap-2">
                <Badge tone={d.render_status === "renderizado" ? "success" : d.render_status === "erro" ? "danger" : d.render_status ? "warn" : "neutral"}>{d.render_status ? `Render: ${d.render_status}` : "Render não iniciado"}</Badge>
                {d.render_tool && <Badge tone="neutral">{d.render_tool}</Badge>}
              </div>
              {d.video_ref && <a href={d.video_ref} target="_blank" className="ds-small text-[color:var(--brand)] hover:underline">Ver vídeo →</a>}
              {["aprovado", "publicado"].includes(d.status)
                ? <form action={dispararRenderVideoAction.bind(null, id)}><button className={btnGhost}>Disparar render</button></form>
                : <p className="ds-small">Aprove o storyboard para renderizar.</p>}
            </Card>
          )}

          {/* Arte & criativos (R3.7) */}
          {(d.content as { creative?: unknown })?.creative ? (
            <Card>
              <div className="mb-2 flex items-center gap-2"><Icon name="gem" size={16} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Criativo</p></div>
              <p className="ds-small mb-3 !mt-0">Template v2 → PNG no tamanho da rede. O fundo por IA é opcional (sob a marca).</p>
              <form action={baixarPngAction.bind(null, id)}><button className={btnPrimary}>Baixar PNG</button></form>
            </Card>
          ) : null}
          {d.line === "post" && (
            <Card>
              <div className="mb-2 flex items-center gap-2"><Icon name="gem" size={16} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Arte pareada</p></div>
              <p className="ds-small mb-3 !mt-0">Gera a arte a partir da sugestão visual do post — copy + arte vinculados para o R4.</p>
              <form action={gerarArteDoPostAction.bind(null, id)}><button className={btnGhost}>Gerar arte do post</button></form>
            </Card>
          )}

          {/* Pacote de formação (R3.5) */}
          {FORMACAO_TIPOS.includes(d.line ?? "") && (
            <Card bloom>
              <div className="mb-2 flex items-center gap-2"><Icon name="graduation" size={16} className="text-[color:var(--brand)]" /><p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Pacote de formação</p></div>
              <p className="ds-small mb-3 !mt-0">Monta os slides e os materiais; o teste vai no corpo do documento; o certificado sai ao concluir.</p>
              <form action={gerarSlidesDaFormacaoAction.bind(null, id)}><button className={btnGhost}>Gerar slides do pacote</button></form>
              {["aprovado", "publicado"].includes(d.status) ? (
                <form action={emitirCertificadoAction.bind(null, id)} className="mt-4 space-y-2 border-t border-hairline pt-3">
                  <p className="ds-small !mt-0 font-medium text-[color:var(--fg-2)]">Emitir certificado</p>
                  <input name="participante" aria-label="Nome do participante" placeholder="Nome do participante" required className="h-9 w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[13px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
                  <div className="flex gap-2">
                    <input name="email" placeholder="E-mail (opcional)" className="h-9 flex-1 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[13px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
                    <input name="nota" aria-label="Nota do teste" placeholder="Nota" className="h-9 w-20 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[13px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
                  </div>
                  <button className={btnPrimary}>Emitir certificado (PDF)</button>
                </form>
              ) : <p className="ds-small">Aprove a formação para emitir certificados.</p>}
            </Card>
          )}

          {/* Versões */}
          <Card>
            <p className="mb-2 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Versões</p>
            <ul className="space-y-1.5">
              {(versions ?? []).map((v) => <li key={v.version} className="flex justify-between font-montserrat text-[13px]"><span className="text-[color:var(--fg-2)]">v{v.version}</span><span className="text-[color:var(--fg-4)]">{new Date(v.created_at).toLocaleString("pt-BR")}</span></li>)}
              {(versions ?? []).length === 0 && <li className="ds-small !mt-0">Ainda não renderizado.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </ContentArea>
  );
}
