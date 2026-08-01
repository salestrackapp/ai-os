import Link from "next/link";
import { SalestrackLogo } from "@/components/ds/SalestrackLogo";
import { confirmarInscricao } from "@/lib/marketing/inscricao";

export const dynamic = "force-dynamic";

/**
 * O clique que faz o consentimento existir.
 *
 * A confirmação acontece no GET, sem botão intermediário: a pessoa já clicou uma vez, no e-mail
 * dela, e pedir um segundo clique só aumentaria a chance de a inscrição morrer no meio. O risco de
 * um scanner de e-mail seguir o link e confirmar sozinho existe, e erra para o lado de inscrever
 * alguém que pediu para se inscrever — inverso do descadastro, onde o erro também é seguro.
 */
export default async function ConfirmarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await confirmarInscricao(token);

  const conteudo = {
    confirmado: {
      titulo: "Inscrição confirmada",
      texto: "Pronto. Você vai receber o próximo e-mail junto com todo mundo — mais ou menos a cada duas semanas. Se em algum momento não fizer mais sentido, o link para sair fica no rodapé de cada mensagem, e funciona no primeiro clique.",
    },
    ja_confirmado: {
      titulo: "Já estava confirmada",
      texto: "Este endereço já tinha sido confirmado antes. Não precisa fazer nada — você continua na lista.",
    },
    expirado: {
      titulo: "O link expirou",
      texto: "Links de confirmação valem por 7 dias, para não ficarem válidos para sempre numa caixa de e-mail. Faça a inscrição de novo e um link novo chega em seguida.",
    },
    invalido: {
      titulo: "Link inválido",
      texto: "Este link não corresponde a nenhuma inscrição ativa. Pode ter sido cancelado ou já substituído por outro mais recente.",
    },
  }[r.estado];

  return (
    <main className="ds flex min-h-screen items-center justify-center bg-[var(--bg-2)] px-6 py-12">
      <div className="w-full max-w-lg rounded-ds-card border border-hairline bg-[var(--bg-1)] p-8">
        <div className="mb-6"><SalestrackLogo width={130} /></div>
        <h1 className="mb-3 font-montserrat text-[24px] font-extrabold leading-tight text-[color:var(--fg-1)]">{conteudo.titulo}</h1>
        <p className="font-montserrat text-[15px] leading-relaxed text-[color:var(--fg-2)]">{conteudo.texto}</p>
        {r.email && r.estado === "confirmado" && (
          <p className="mt-3 font-montserrat text-[13px] text-[color:var(--fg-3)]">Endereço confirmado: <b>{r.email}</b></p>
        )}
        {(r.estado === "expirado" || r.estado === "invalido") && (
          <Link href="/inscrever" className="ds-focus mt-6 inline-flex h-11 items-center rounded-ds-input bg-brand px-5 font-montserrat text-[15px] font-semibold text-white shadow-ds-brand hover:bg-brand-hover">
            Inscrever de novo
          </Link>
        )}
      </div>
    </main>
  );
}
