/**
 * Logo oficial da Salestrack AI — imagem original (arquivo em /public/salestrack-ai.png),
 * usada SEM alteração de arte. Wordmark "salestrack AI" (1600×600, fundo transparente).
 * Reusável no admin, portal, landing e login. Largura padrão 250px (max-w-full p/ não
 * estourar containers estreitos como a sidebar).
 */

type Props = {
  /** Legenda opcional sob o logo (ex.: "AI OS · admin"). */
  subtitle?: string;
  /** Largura do logo em px (default 250). A altura acompanha proporcionalmente. */
  width?: number;
  className?: string;
};

export function SalestrackLogo({ subtitle, width = 250, className }: Props) {
  return (
    <div className={`inline-flex flex-col ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/salestrack-ai.png" alt="Salestrack AI" style={{ width, height: "auto" }} className="max-w-full object-contain" />
      {subtitle && (
        <span className="mt-1 font-jbmono text-[10px] uppercase tracking-[0.14em] text-[color:var(--fg-3)]">{subtitle}</span>
      )}
    </div>
  );
}
