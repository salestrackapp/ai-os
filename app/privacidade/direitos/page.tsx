import { SalestrackLogo } from "@/components/ds/SalestrackLogo";
import { FormularioDireitos } from "@/components/lgpd/FormularioDireitos";
import { EMAIL_ENCARREGADO, NOME_ENCARREGADO } from "@/lib/lgpd/contato";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Seus dados na Salestrack AI",
  description: "Peça acesso, correção, exclusão ou portabilidade dos seus dados pessoais. Respondemos em até 15 dias.",
};

/**
 * A porta de entrada do titular.
 *
 * Vive no AI OS pelo mesmo motivo que a inscrição: os dois sites, o rodapé de cada campanha e o
 * aviso de prospecção apontam todos para cá, e a obrigação legal fica implementada uma vez só. Um
 * formulário por superfície seriam três implementações da mesma obrigação — e a que divergisse
 * seria justamente a que deixaria um pedido cair no vazio.
 */
export default function DireitosPage() {
  return (
    <main className="ds flex min-h-screen items-center justify-center bg-[var(--bg-2)] px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8"><SalestrackLogo width={140} /></div>

        <h1 className="mb-3 font-montserrat text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-[color:var(--fg-1)]">
          Seus dados são seus
        </h1>
        <p className="mb-6 font-montserrat text-[15px] leading-relaxed text-[color:var(--fg-2)]">
          A lei brasileira de proteção de dados (LGPD) dá a você o direito de saber o que uma
          empresa guarda a seu respeito, corrigir o que está errado, levar embora e mandar apagar.
          Este formulário é a via direta para isso — sem precisar de conta, sem ter que explicar
          por quê.
        </p>
        <p className="mb-7 font-montserrat text-[14px] leading-relaxed text-[color:var(--fg-3)]">
          Depois que você confirmar pelo e-mail, temos <b>15 dias</b> para responder. Cada pedido
          entra num registro com prazo, e quem cuida disso é uma pessoa — não uma fila automática.
        </p>

        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-6">
          <FormularioDireitos />
        </div>

        <p className="mt-5 font-montserrat text-[12.5px] leading-relaxed text-[color:var(--fg-3)]">
          Encarregado de dados: {NOME_ENCARREGADO} · <a href={`mailto:${EMAIL_ENCARREGADO}`} className="text-[color:var(--brand)] hover:underline">{EMAIL_ENCARREGADO}</a>.
          Prefere escrever direto? Também vale — mas por aqui o pedido já entra com prazo contado.
        </p>
      </div>
    </main>
  );
}
