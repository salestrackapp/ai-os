import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCursoPorSlug, minhaMatricula, modulosComProgresso, progressoDoCurso } from "@/lib/academy/queries";

export const dynamic = "force-dynamic";

export default async function CursoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const curso = await buscarCursoPorSlug(slug);
  if (!curso) notFound(); // RLS já filtrou: sem matrícula, o curso simplesmente não existe para a pessoa

  const matricula = await minhaMatricula(curso.id);
  const mods = await modulosComProgresso(curso.id, matricula?.id ?? null);
  const p = progressoDoCurso(mods);

  return (
    <>
      <header className="mb-6">
        <p className="acad-eyebrow">Salestrack AI Academy</p>
        <h1 className="acad-h1">{curso.titulo}</h1>
        {curso.subtitulo && <p className="acad-sub">{curso.subtitulo}</p>}
      </header>

      {matricula && p.total > 0 && (
        <div className="acad-card mb-6 p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-[color:var(--navy)]">
              {p.feitas} de {p.total} tarefas · {p.modulosOk} de {p.modulos} módulos
            </span>
            <span className="font-mono text-[12px] text-[color:var(--cyan2)]">{p.pct}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#F0F3F7]">
            <div className="h-full rounded-full bg-[var(--cyan)] transition-[width]" style={{ width: `${p.pct}%` }} />
          </div>
          {p.pct === 100 && curso.certificado && (
            <p className="mt-3 text-[12px] text-[color:var(--acad-text)]">
              Trilha concluída. A avaliação libera o certificado.
            </p>
          )}
        </div>
      )}

      {mods.length === 0 ? (
        <div className="acad-card p-8 text-center"><p className="text-[15px] font-bold text-[color:var(--navy)]">Conteúdo em preparação</p><p className="mt-1 text-[13px] text-[color:var(--acad-muted)]">Os módulos desta trilha ainda não foram publicados.</p></div>
      ) : (
        <ol className="space-y-3">
          {mods.map((m) => {
            const feitas = m.tarefas.filter((t) => t.feita).length;
            const completo = m.tarefas.length > 0 && feitas === m.tarefas.length;
            return (
              <li key={m.id}>
                <Link href={`/academy/trilha/${slug}/${m.ordem}`} className="ds-focus block">
                  <div className="acad-card p-5">
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-[12px] text-[color:var(--acad-muted)]">
                        {m.icone ?? String(m.ordem).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-[color:var(--navy)]">{m.titulo}</p>
                        {m.objetivo && <p className="mt-1 text-[12px] text-[color:var(--acad-muted)]">{m.objetivo}</p>}
                        <p className="mt-2 font-mono text-[11px] text-[color:var(--acad-muted)]">
                          {m.aulas} {m.aulas === 1 ? "seção" : "seções"}
                          {m.tempo_label ? ` · ${m.tempo_label}` : ""}
                          {m.tarefas.length ? ` · ${feitas}/${m.tarefas.length} tarefas` : ""}
                        </p>
                      </div>
                      {completo && <span className="text-[12px] text-[color:var(--cyan2)]">✓</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
