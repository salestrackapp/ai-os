/**
 * Logo oficial da Salestrack AI — imagem original (arquivo em /public/salestrack-ai.png),
 * usada SEM alteração de arte. Wordmark "salestrack AI" (1600×600, fundo transparente).
 * Reusável no admin, portal, landing e login. Largura padrão 250px (max-w-full p/ não
 * estourar containers estreitos como a sidebar).
 */

type Props = {
  /** Legenda opcional sob o logo (ex.: "AI OS · admin"). */
  subtitle?: string;
  /** Largura do logo em px (default 156). A altura acompanha proporcionalmente. */
  width?: number;
  /**
   * "light" usa a arte de texto branco, para fundo escuro — é a mesma da Academy.
   * A arte padrão é navy sobre claro e some na barra superior escura.
   */
  variant?: "dark" | "light";
  className?: string;
};

export function SalestrackLogo({ subtitle, width = 156, variant = "dark", className }: Props) {
  const src = variant === "light" ? "/salestrack-academy-logo.png" : "/salestrack-ai.png";
  return (
    <div className={`inline-flex flex-col ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Salestrack AI" style={{ width, height: "auto" }} className="max-w-full object-contain" />
      {subtitle && (
        <span className="mt-1 font-jbmono text-[11px] uppercase tracking-[0.14em] text-[color:var(--fg-3)]">{subtitle}</span>
      )}
    </div>
  );
}
