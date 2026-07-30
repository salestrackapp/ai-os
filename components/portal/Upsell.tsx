import { FEATURE_LABELS } from "@/lib/plans/features";
import { Icon } from "@/components/ui/icons";

/** Upsell elegante quando o recurso não está no plano do cliente. Nunca um erro. */
export function Upsell({ feature, plano = "Professional" }: { feature: string; plano?: string }) {
  return (
    <div className="max-w-2xl">
      <div className="card p-8 border-goldline bg-[rgba(0, 122, 148,.05)] text-center">
        <p className="mb-3 text-gold flex justify-center"><Icon name="sparkles" size={28} /></p>
        <h1 className="font-serif text-2xl font-semibold mb-2">{FEATURE_LABELS[feature] ?? feature} está no plano {plano}</h1>
        <p className="text-sm text-muted leading-relaxed mb-5">
          Este recurso faz parte de um plano superior do AI OS. Fale com a Salestrack para liberá-lo no seu programa e destravar todo o valor da plataforma.
        </p>
        <a href="mailto:andre.kachan@salestrack.com.br?subject=Quero%20o%20plano%20Professional%20no%20AI%20OS" className="btn-gold text-sm">Quero conhecer o {plano}</a>
      </div>
    </div>
  );
}
