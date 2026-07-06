import "server-only";

/**
 * Ferramentas de vídeo da Salestrack (R3.8) — server-only. O AI OS NUNCA conecta a sistemas do cliente.
 * Apresentador/avatar → HeyGen; geração → Higgsfield. Sem credencial → render fica PENDENTE (graceful).
 */
export type VideoTool = "heygen" | "higgsfield";

/** Ferramenta adequada ao tipo, se houver credencial no servidor; senão null (graceful). */
export function videoToolFor(tipo?: string): VideoTool | null {
  const hasHeygen = !!process.env.HEYGEN_API_KEY;
  const hasHiggs = !!process.env.HIGGSFIELD_API_KEY;
  if (tipo === "apresentador" || tipo === "avatar") return hasHeygen ? "heygen" : null;
  if (tipo === "geracao" || tipo === "explainer") return hasHiggs ? "higgsfield" : (hasHeygen ? "heygen" : null);
  return hasHeygen ? "heygen" : hasHiggs ? "higgsfield" : null;
}

export function videoToolConfigured(tipo?: string): boolean {
  return videoToolFor(tipo) !== null;
}

/**
 * Dispara o render na ferramenta (server-only). Baseline: ponto de integração — quando a credencial
 * existir, envia roteiro/storyboard/voiceover e devolve o job. Sem credencial → 'pendente'.
 */
export async function triggerVideoRender(opts: { tipo?: string; roteiro: unknown; storyboard: unknown; voiceover?: string | null }):
  Promise<{ status: "renderizando" | "pendente"; tool: VideoTool | null; video_ref: string | null }> {
  const tool = videoToolFor(opts.tipo);
  if (!tool) return { status: "pendente", tool: null, video_ref: null };
  // Ponto de integração com a API da ferramenta (server-only). O job assíncrono atualiza video_ref/render_status depois.
  return { status: "renderizando", tool, video_ref: null };
}
