import { createServiceClient } from "@/lib/supabase/service";
import { revogarMarketing, registrarOposicao } from "@/lib/lgpd/consentimento";
import { SalestrackLogo } from "@/components/ds";

export const dynamic = "force-dynamic";

/**
 * Descadastro em um clique. Sem sessão, sem formulário, sem "tem certeza?".
 *
 * Abrir o link JÁ descadastra. Pedir confirmação numa página de saída é dark pattern: a pessoa
 * clicou em "não quero mais receber" — a intenção está clara e cobrar mais um passo só serve
 * para reter quem desistiu no meio do caminho. Quem se arrepender tem o botão para voltar,
 * logo abaixo.
 *
 * Mesmo padrão das outras rotas públicas (/certificado, /entregavel): service client,
 * igualdade contra uma coluna, e nada da pessoa exposto além do endereço que ela já conhece.
 */
export default async function Descadastro({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = createServiceClient();

  const { data: t } = await sb.from("descadastro_tokens")
    .select("token, canal, endereco").eq("token", token).maybeSingle();

  /**
   * Um link só, para as duas coisas. Do lado de quem clica existe UMA intenção — "não quero
   * contato de vocês" —, e obrigá-la a descobrir que marketing e prospecção são regimes jurídicos
   * distintos seria transferir o nosso problema para ela.
   *
   * Por baixo são dois atos diferentes: revogar consentimento de marketing (art. 8º, §5º) e
   * opor-se ao tratamento por legítimo interesse (art. 18, §2º). O segundo só existe se a pessoa
   * estiver na base de prospecção — e é isso que muda o texto da página.
   */
  let eraProspect = false;
  if (t) {
    const endereco = t.endereco as string;
    const { count } = await sb.from("prospects")
      .select("id", { count: "exact", head: true }).ilike("email", endereco);
    eraProspect = (count ?? 0) > 0;

    await revogarMarketing(endereco, t.canal as "email" | "whatsapp");
    if (eraProspect) await registrarOposicao(endereco);
    await sb.from("descadastro_tokens").update({ usado_em: new Date().toISOString() }).eq("token", token);
  }

  // Endereço parcialmente oculto: o link pode acabar num histórico compartilhado, e a pessoa
  // só precisa reconhecer qual endereço saiu — não vê-lo por extenso.
  const mascarar = (e: string) => {
    const [u, d] = e.split("@");
    if (!d) return e;
    return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
  };

  return (
    <main className="ds flex min-h-screen items-center justify-center bg-[var(--bg-2)] px-6 py-12">
      <div className="w-full max-w-lg rounded-[14px] border border-hairline bg-[var(--bg-1)] p-8">
        <div className="mb-6"><SalestrackLogo width={130} /></div>

        {!t ? (<>
          <p className="ds-eyebrow">Descadastro</p>
          <h1 className="ds-h1 mt-2">Link não reconhecido</h1>
          <p className="ds-lead mt-2">
            Este link de descadastro não é válido. Se você continua recebendo mensagens que não
            quer, escreva para <a className="underline" href="mailto:andre.kachan@salestrack.com.br">andre.kachan@salestrack.com.br</a> e
            resolvemos manualmente — você não precisa de link nenhum para exercer esse direito.
          </p>
        </>) : (<>
          <p className="ds-eyebrow">Pronto</p>
          <h1 className="ds-h1 mt-2">Você foi descadastrado</h1>
          <p className="ds-lead mt-2">
            <b>{mascarar(t.endereco as string)}</b> não vai mais receber{" "}
            {eraProspect ? "contato comercial nem comunicações de marketing" : "comunicações de marketing"}{" "}
            da Salestrack AI.
          </p>
          {eraProspect && (
            <div className="mt-4 rounded-[10px] border border-hairline bg-[var(--bg-2)] p-4">
              <p className="ds-small">
                Seus dados profissionais também foram retirados da nossa base de prospecção. Eles
                tinham vindo de fonte pública e eram apenas nome, cargo e empresa — nunca dados
                pessoais.
              </p>
            </div>
          )}
          <div className="mt-4 rounded-[10px] border border-hairline bg-[var(--bg-2)] p-4">
            <p className="ds-small">
              Mensagens sobre algo que você pediu diretamente — uma resposta a um contato seu, um
              documento de um projeto em andamento — não fazem parte deste descadastro e continuam
              chegando. Se quiser sair também dessas, ou apagar seus dados por completo, escreva
              para <a className="underline" href="mailto:andre.kachan@salestrack.com.br">andre.kachan@salestrack.com.br</a>.
            </p>
          </div>
          <p className="ds-small mt-6 text-[color:var(--fg-3)]">
            Saiu sem querer? Basta responder a qualquer e-mail nosso pedindo para voltar.
          </p>
        </>)}
      </div>
    </main>
  );
}
