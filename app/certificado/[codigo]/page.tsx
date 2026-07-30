import { createServiceClient } from "@/lib/supabase/service";
import { SalestrackLogo } from "@/components/ds";

export const dynamic = "force-dynamic";

/**
 * Verificação pública de certificado. Sem sessão — o código É o segredo, mesmo padrão de
 * /p/[token] e /entregavel/[token]: service client, igualdade contra uma coluna, colunas
 * explícitas no select.
 *
 * Mostra o suficiente para confirmar que o documento é legítimo e NADA além: nome, curso,
 * data e versão. Sem e-mail, sem nota, sem PDF. Quem verifica é um terceiro — normalmente
 * um recrutador —, não o dono do certificado.
 */
export default async function VerificarCertificado({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const sb = createServiceClient();

  const { data: c } = await sb.from("formacao_certificados")
    .select("participante_nome, formacao_titulo, carga_horaria, course_versao, emitido_em, deleted_at")
    .eq("codigo", codigo.toUpperCase()).maybeSingle();

  const valido = !!c && !c.deleted_at;

  return (
    <main className="ds flex min-h-screen items-center justify-center bg-[var(--bg-2)] px-6 py-12">
      <div className="w-full max-w-lg rounded-[14px] border border-hairline bg-[var(--bg-1)] p-8">
        <div className="mb-6"><SalestrackLogo width={130} /></div>

        {!valido ? (<>
          <p className="ds-eyebrow">Verificação</p>
          <h1 className="ds-h1 mt-2">Certificado não encontrado</h1>
          <p className="ds-lead mt-2">
            Não localizamos nenhum certificado com este código. Confira se ele foi digitado corretamente —
            o código tem doze caracteres, no formato ABCD-EFGH-IJKL.
          </p>
        </>) : (<>
          <p className="ds-eyebrow">Certificado verificado</p>
          <h1 className="ds-h1 mt-2">{c!.participante_nome}</h1>
          <p className="ds-lead mt-2">concluiu <b>{c!.formacao_titulo}</b>.</p>

          <dl className="mt-6 space-y-3 border-t border-hairline pt-5">
            {c!.carga_horaria && (
              <div><dt className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Carga horária</dt>
                <dd className="mt-0.5 text-base text-[color:var(--fg-2)]">{c!.carga_horaria}</dd></div>
            )}
            <div><dt className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Emitido em</dt>
              <dd className="mt-0.5 text-base text-[color:var(--fg-2)]">{new Date(c!.emitido_em).toLocaleDateString("pt-BR")}</dd></div>
            {c!.course_versao && (
              <div><dt className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Versão do curso</dt>
                <dd className="mt-0.5 text-base text-[color:var(--fg-2)]">{c!.course_versao}</dd></div>
            )}
            <div><dt className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Código</dt>
              <dd className="mt-0.5 font-jbmono text-base tracking-[.06em] text-[color:var(--brand-deep)]">{codigo.toUpperCase()}</dd></div>
          </dl>

          <p className="mt-6 text-sm text-[color:var(--fg-3)]">
            Emitido pela Salestrack AI. Esta página confirma a autenticidade do certificado.
          </p>
        </>)}
      </div>
    </main>
  );
}
