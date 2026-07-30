import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveLearner } from "@/lib/academy/learner";
import { signedArtifactUrl } from "@/lib/deliverables/render";
import { CopyButton } from "@/components/ui/CopyButton";

export const dynamic = "force-dynamic";

/**
 * Certificados do aluno. Substitui a mensagem sem saída da versão anterior
 * ("Fale com a Salestrack para receber seu certificado") — agora ele sai sozinho.
 */
export default async function CertificadosPage() {
  await resolveLearner();
  const sb = await createClient();

  // A RLS já limita ao dono (ou ao gestor da org). Não há filtro manual de posse aqui.
  const { data } = await sb.from("formacao_certificados")
    .select("id, codigo, formacao_titulo, participante_nome, course_versao, emitido_em, rendered_url")
    .is("deleted_at", null).order("emitido_em", { ascending: false });

  const certificados = await Promise.all((data ?? []).map(async (c) => ({
    ...c, url: c.rendered_url ? await signedArtifactUrl(c.rendered_url, true) : null,
  })));

  return (
    <>
      <header className="mb-6">
        <p className="acad-eyebrow">Salestrack AI Academy</p>
        <h1 className="acad-h1">Meus certificados</h1>
        <p className="acad-sub">Emitidos automaticamente ao concluir a trilha e passar na avaliação.</p>
      </header>

      {certificados.length === 0 ? (
        <div className="acad-card p-8 text-center">
          <p className="text-[15px] font-bold text-[color:var(--navy)]">Nenhum certificado ainda</p>
          <p className="mt-1.5 text-[14px] text-[color:var(--acad-muted)]">
            Conclua as tarefas da trilha e passe na avaliação final — o certificado sai sozinho, sem precisar pedir.
          </p>
          <Link href="/academy/trilha" className="acad-btn-cyan mt-4 inline-block">Continuar a trilha</Link>
        </div>
      ) : (
        <div className="acad-grid-lg">
          {certificados.map((c) => (
            <div key={c.id} className="acad-card p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[color:var(--acad-muted)]">Certificado</p>
              <p className="mt-1 text-[16px] font-extrabold text-[color:var(--navy)]">{c.formacao_titulo}</p>
              <p className="mt-0.5 text-[14px] text-[color:var(--acad-muted)]">
                {c.participante_nome} · emitido em {new Date(c.emitido_em).toLocaleDateString("pt-BR")}
                {c.course_versao ? ` · versão ${c.course_versao} do curso` : ""}
              </p>
              {c.codigo && (
                <p className="mt-3 font-jbmono text-[14px] font-bold tracking-[.06em] text-[color:var(--cyan2)]">{c.codigo}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {c.url && <a href={c.url} className="acad-btn-cyan">Baixar PDF</a>}
                {c.codigo && (
                  <CopyButton className="acad-btn-copy" label="Copiar link de verificação"
                    text={`https://ai-os-sable.vercel.app/certificado/${c.codigo}`} />
                )}
              </div>
              <p className="mt-3 text-[13px] text-[color:var(--acad-muted)]">
                O link de verificação é público: quem receber consegue conferir que o certificado é legítimo,
                sem acessar sua conta.
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
