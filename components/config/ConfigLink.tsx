import Link from "next/link";
import { Icon } from "@/components/ui/icons";

/** Atalho contextual para a categoria correspondente no Console de Configurações. */
export function ConfigLink({ cat, label = "Configurar" }: { cat: string; label?: string }) {
  return (
    <Link href={`/admin/configuracoes/parametros?cat=${cat}`} className="btn-ghost text-xs whitespace-nowrap" title="Abrir no Console de Configurações">
      <Icon name="settings" size={13} /> {label}
    </Link>
  );
}
