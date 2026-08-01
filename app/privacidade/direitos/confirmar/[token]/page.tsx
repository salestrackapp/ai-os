import Link from "next/link";
import { SalestrackLogo } from "@/components/ds/SalestrackLogo";
import { ConfirmarPedido } from "@/components/lgpd/ConfirmarPedido";
import { lerPedidoPendente } from "@/lib/lgpd/pedido-publico";

export const dynamic = "force-dynamic";

/**
 * A página do link que chegou no e-mail do titular.
 *
 * Ela LÊ e não confirma. A confirmação só acontece no botão — ver `lerPedidoPendente` para o
 * porquê da divergência em relação à confirmação da newsletter, que acontece no próprio GET.
 */
export default async function ConfirmarPedidoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await lerPedidoPendente(token);

  const aviso = {
    ja_confirmado: {
      titulo: "Este pedido já estava confirmado",
      texto: "Não precisa fazer nada. Ele já está no nosso registro e será respondido dentro do prazo.",
    },
    expirado: {
      titulo: "O link expirou",
      texto: "Links de confirmação valem por 3 dias — curtos de propósito, porque é a partir da confirmação que corre o nosso prazo de resposta. Faça o pedido de novo e um link novo chega em seguida.",
    },
    invalido: {
      titulo: "Link inválido",
      texto: "Este link não corresponde a nenhum pedido. Pode já ter sido substituído por outro mais recente.",
    },
  }[p.estado as "ja_confirmado" | "expirado" | "invalido"];

  return (
    <main className="ds flex min-h-screen items-center justify-center bg-[var(--bg-2)] px-6 py-12">
      <div className="w-full max-w-lg rounded-ds-card border border-hairline bg-[var(--bg-1)] p-8">
        <div className="mb-6"><SalestrackLogo width={130} /></div>

        {p.estado === "pendente" ? (
          <ConfirmarPedido token={token} tipo={p.tipo!} email={p.email!} />
        ) : (
          <>
            <h1 className="mb-3 font-montserrat text-[24px] font-extrabold leading-tight text-[color:var(--fg-1)]">{aviso.titulo}</h1>
            <p className="font-montserrat text-[15px] leading-relaxed text-[color:var(--fg-2)]">{aviso.texto}</p>
            {p.estado !== "ja_confirmado" && (
              <Link href="/privacidade/direitos" className="ds-focus mt-6 inline-flex h-11 items-center rounded-ds-input bg-brand px-5 font-montserrat text-[15px] font-semibold text-white shadow-ds-brand hover:bg-brand-hover">
                Fazer o pedido de novo
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
