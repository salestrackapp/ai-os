/** Entregável público (UC) — renderiza por tipo: doc/vídeo/podcast/curso passo a passo/app por link. */
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { signedArtifactUrl } from "@/lib/deliverables/render";
import { sanitizeEmailHtml } from "@/lib/relacionamento/sanitize-email";
import { tipoDef, familiaLabel, progressoModulos } from "@/lib/estudio/catalogo";
import { SalestrackLogo } from "@/components/ds/SalestrackLogo";
import { marcarModuloAction } from "./actions";

export const dynamic = "force-dynamic";

function Aviso({ msg }: { msg: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-2)] px-6">
      <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-10 text-center shadow-ds-card">
        <p className="ds-eyebrow">Salestrack AI</p>
        <h1 className="mt-2 font-montserrat text-2xl font-semibold text-[color:var(--fg-1)]">Entrega indisponível</h1>
        <p className="mt-2 font-montserrat text-sm text-[color:var(--fg-3)]">{msg}</p>
      </div>
    </main>
  );
}

/** youtube/vimeo → iframe embed; senão null. */
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default async function PublicDeliverable({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = createServiceClient();
  const { data: d } = await sb.from("studio_deliverables")
    .select("id, org_id, kind, title, status, content, external_url, video_ref, rendered_url")
    .eq("public_token", token).maybeSingle();
  if (!d) return <Aviso msg="O link é inválido ou foi revogado." />;
  if (!["aprovado", "entregue", "publicado"].includes(d.status)) return <Aviso msg="Esta entrega ainda não foi liberada. Fale com a Salestrack." />;

  const def = tipoDef(d.kind);

  // Documentos clássicos com arquivo renderizado → mantém o comportamento atual (redireciona ao arquivo assinado).
  if (def.consumo === "single" && d.rendered_url) {
    const url = await signedArtifactUrl(d.rendered_url, false);
    if (url) redirect(url);
  }

  const midiaUrl: string | null = d.external_url || d.video_ref || null;
  const content = (d.content ?? {}) as { html?: string; texto?: string };

  // corpo por tipo
  let corpo: React.ReactNode;
  if (def.consumo === "passo_a_passo") {
    const [{ data: mods }, { data: prog }] = await Promise.all([
      sb.from("studio_modules").select("id, ordem, titulo, conteudo, url").eq("deliverable_id", d.id).order("ordem"),
      sb.from("deliverable_progress").select("module_index").eq("deliverable_id", d.id).eq("subject_type", "org").eq("subject_id", d.org_id),
    ]);
    const feitos = new Set((prog ?? []).map((p) => p.module_index));
    const total = (mods ?? []).length;
    const pct = progressoModulos(total, feitos.size);
    corpo = (
      <div>
        <div className="mb-4"><div className="mb-1 flex justify-between font-montserrat text-[12px] text-[color:var(--fg-3)]"><span>Progresso</span><span>{feitos.size}/{total} · {pct}%</span></div><div className="h-2 w-full rounded-full bg-[var(--bg-2)]"><div className="h-2 rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} /></div></div>
        {pct === 100 && total > 0 && <div className="mb-4 rounded-ds-input bg-[var(--tile)] px-4 py-3 font-montserrat text-[13px] text-[color:var(--brand-deep)]">🎉 Você concluiu <b>{d.title}</b>! Fale com a Salestrack para receber seu certificado.</div>}
        <ol className="space-y-3">
          {(mods ?? []).map((mod) => {
            const feito = feitos.has(mod.ordem);
            const obj = (mod.conteudo as { objetivo?: string })?.objetivo;
            return (
              <li key={mod.id} className={`rounded-ds-card border p-4 ${feito ? "border-[color:var(--brand-light)] bg-[var(--tile)]" : "border-hairline bg-[var(--bg-1)]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-montserrat text-[11px] font-semibold uppercase tracking-[.1em] text-[color:var(--fg-4)]">Módulo {mod.ordem}</p>
                    <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">{mod.titulo}</p>
                    {obj && <p className="mt-1 font-montserrat text-[13px] text-[color:var(--fg-2)]">{obj}</p>}
                    {mod.url && <a href={mod.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-montserrat text-[12px] font-semibold text-[color:var(--brand)] hover:underline">Abrir conteúdo →</a>}
                  </div>
                  <form action={marcarModuloAction.bind(null, token, d.id, d.org_id, mod.ordem, !feito)}>
                    <button className={`ds-focus shrink-0 rounded-ds-input px-3 py-2 font-montserrat text-[12px] font-semibold ${feito ? "border border-hairline-strong text-[color:var(--fg-2)]" : "bg-brand text-white shadow-ds-brand hover:bg-brand-hover"}`}>{feito ? "✓ concluído" : "Concluir"}</button>
                  </form>
                </div>
              </li>
            );
          })}
          {total === 0 && <li className="font-montserrat text-[13px] text-[color:var(--fg-3)]">Os módulos serão publicados em breve.</li>}
        </ol>
      </div>
    );
  } else if (def.consumo === "midia" && def.key === "podcast" && midiaUrl) {
    corpo = <audio controls src={midiaUrl} className="w-full">Seu navegador não suporta áudio.</audio>;
  } else if (def.consumo === "midia" && midiaUrl) {
    const emb = embedUrl(midiaUrl);
    corpo = emb
      ? <div className="relative w-full overflow-hidden rounded-ds-card" style={{ paddingTop: "56.25%" }}><iframe src={emb} title={d.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full border-0" /></div>
      : <video controls src={midiaUrl} className="w-full rounded-ds-card">Seu navegador não suporta vídeo.</video>;
  } else if (def.consumo === "externo") {
    corpo = midiaUrl
      ? <a href={midiaUrl} target="_blank" rel="noopener noreferrer" className="ds-focus inline-flex h-12 items-center rounded-ds-input bg-brand px-6 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Abrir {def.label} →</a>
      : <p className="font-montserrat text-[13px] text-[color:var(--fg-3)]">O link será disponibilizado em breve.</p>;
  } else {
    // single: HTML sanitizado ou texto
    corpo = content.html
      ? <div className="prose-body font-montserrat text-[14px] leading-relaxed text-[color:var(--fg-1)]" dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(content.html) }} />
      : <p className="whitespace-pre-wrap font-montserrat text-[14px] leading-relaxed text-[color:var(--fg-1)]">{content.texto || "Conteúdo em preparação."}</p>;
  }

  return (
    <main className="min-h-screen bg-[var(--bg-2)] py-10">
      <div className="mx-auto max-w-3xl px-5">
        <header className="mb-6 flex items-center justify-between gap-4">
          <SalestrackLogo />
          <span className="rounded-ds-pill bg-[var(--tile)] px-3 py-1 font-montserrat text-[12px] font-semibold text-[color:var(--brand-deep)]">{familiaLabel(def.familia)}</span>
        </header>
        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-6 shadow-ds-card sm:p-8">
          <p className="ds-eyebrow">{def.label}</p>
          <h1 className="mt-1 mb-5 font-montserrat text-[26px] font-bold leading-tight text-[color:var(--fg-1)]">{d.title}</h1>
          {corpo}
        </div>
        <p className="mt-6 text-center font-montserrat text-[11px] text-[color:var(--fg-4)]">Entregue por Salestrack AI</p>
      </div>
    </main>
  );
}
