import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Trilha de Aprendizado. Com uma única trilha — o caso de hoje — vai direto para ela,
 * reproduzindo a navegação da academy antiga, onde "Trilha" abria o conteúdo na hora.
 */
export default async function TrilhaPage() {
  const sb = await createClient();
  const { data: cursos } = await sb
    .from("academy_courses")
    .select("id, slug, titulo, subtitulo, nivel, carga_horaria_min")
    .is("deleted_at", null)
    .order("titulo");

  if ((cursos ?? []).length === 1) redirect(`/academy/trilha/${cursos![0].slug}`);

  return (
    <>
      <header className="mb-6">
        <p className="acad-eyebrow">Salestrack AI Academy</p>
        <h1 className="acad-h1">Trilha de Aprendizado</h1>
        <p className="acad-sub">Suas formações liberadas.</p>
      </header>
      {(cursos ?? []).length === 0 ? (
        <div className="acad-card p-8 text-center"><p className="text-[15px] font-bold text-[color:var(--navy)]">Nenhuma trilha liberada ainda</p><p className="mt-1 text-[13px] text-[color:var(--acad-muted)]">Assim que uma formação for liberada para você, ela aparece aqui.</p></div>
      ) : (
        <div className="acad-grid">
          {(cursos ?? []).map((c) => (
            <Link key={c.id} href={`/academy/trilha/${c.slug}`} className="ds-focus block">
              <div className="acad-card h-full p-5">
                <span className="block text-[11px] uppercase tracking-[.18em] text-[color:var(--acad-muted)]">
                  {c.nivel}{c.carga_horaria_min ? ` · ${Math.round(c.carga_horaria_min / 60)}h` : ""}
                </span>
                <h2 className="mt-2 text-[15px] font-semibold text-[color:var(--navy)]">{c.titulo}</h2>
                {c.subtitulo && <p className="mt-1 text-[12px] text-[color:var(--acad-muted)]">{c.subtitulo}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
