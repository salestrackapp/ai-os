import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveLearner } from "@/lib/academy/learner";
import { AcademyChrome, type AgenteResumo } from "@/components/academy/AcademyChrome";

/**
 * Serve aluno avulso, aluno corporativo e admin — por isso NÃO exige organização.
 *
 * A guarda é aqui, e não no middleware.ts, de propósito: o comentário no matcher daquele
 * arquivo explica que ele foi enxugado para rotas públicas não pagarem ida e volta ao
 * Supabase Auth, e /academy terá filhos públicos (inscrição, verificação de certificado).
 */
export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const l = await resolveLearner();
  if (!l) redirect("/login?next=/academy");

  // a lista de agentes vive na barra lateral, como na academy anterior
  const sb = await createClient();
  const { data: agentes } = await sb.from("academy_agents")
    .select("id, nome, status").is("deleted_at", null).order("updated_at", { ascending: false }).limit(12);

  return (
    <AcademyChrome email={l.email ?? ""} agentes={(agentes ?? []) as AgenteResumo[]}>
      {children}
    </AcademyChrome>
  );
}
