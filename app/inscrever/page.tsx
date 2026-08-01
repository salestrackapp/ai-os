import { SalestrackLogo } from "@/components/ds/SalestrackLogo";
import { FormularioInscricao } from "@/components/marketing/FormularioInscricao";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Receber os e-mails da Salestrack AI",
  description: "IA que opera de verdade — em vendas, marketing, operações, atendimento e backoffice. Casos reais, com número, e o que não funcionou.",
};

/**
 * Página pública de inscrição.
 *
 * Vive no AI OS, e não nos sites, de propósito: assim qualquer superfície — o site institucional, o
 * pessoal, um post, a assinatura de e-mail — aponta para o mesmo lugar, e a regra de consentimento
 * mora junto de quem envia. Um formulário por site significaria três implementações da mesma
 * obrigação legal, e a que divergir vai ser a que autoriza a mais.
 */
export default function InscreverPage() {
  return (
    <main className="ds flex min-h-screen items-center justify-center bg-[var(--bg-2)] px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8"><SalestrackLogo width={140} /></div>

        <h1 className="mb-3 font-montserrat text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-[color:var(--fg-1)]">
          O que aprendemos colocando IA para trabalhar dentro das empresas
        </h1>
        <p className="mb-6 font-montserrat text-[15px] leading-relaxed text-[color:var(--fg-2)]">
          A cada duas semanas, o que testamos com cliente de verdade — em vendas, marketing,
          operações, atendimento e backoffice. O caso, o número e o que não funcionou. Sem teoria
          e sem novidade de LinkedIn.
        </p>

        <ul className="mb-7 space-y-2">
          {[
            "Casos reais por área: comercial, marketing, operações, atendimento, financeiro, RH e jurídico",
            "Agentes e automações que dá para copiar — com o custo mensal de cada um",
            "Governança: usar IA sem shadow AI, sem risco de dado e sem travar o time",
            "Como preparar as pessoas, não só as ferramentas",
            "E o que não vale a pena, para você não perder tempo",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2 font-montserrat text-[14px] text-[color:var(--fg-2)]">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />{t}
            </li>
          ))}
        </ul>

        <div className="rounded-ds-card border border-hairline bg-[var(--bg-1)] p-6">
          <FormularioInscricao />
        </div>

        <p className="mt-5 font-montserrat text-[12.5px] leading-relaxed text-[color:var(--fg-3)]">
          Seus dados são tratados pela Salestrack AI para enviar este conteúdo, com base no seu
          consentimento. Você sai quando quiser, pelo link no rodapé de cada e-mail. Encarregado de
          dados: André Kachan · <a href="mailto:andre.kachan@salestrack.com.br" className="text-[color:var(--brand)] hover:underline">andre.kachan@salestrack.com.br</a>.
        </p>
      </div>
    </main>
  );
}
