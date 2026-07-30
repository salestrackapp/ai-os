import Link from "next/link";
import { notFound } from "next/navigation";
import { BlocoAula } from "@/components/academy/Blocos";
import { buscarCursoPorSlug, minhaMatricula, modulosComProgresso, aulasDoModulo } from "@/lib/academy/queries";
import { marcarTarefa, desmarcarTarefa } from "../actions";
import type { Bloco } from "@/lib/academy/blocks";

export const dynamic = "force-dynamic";

export default async function ModuloPage({ params }: { params: Promise<{ slug: string; modulo: string }> }) {
  const { slug, modulo } = await params;
  const ordem = Number.parseInt(modulo, 10);
  if (Number.isNaN(ordem)) notFound();

  const curso = await buscarCursoPorSlug(slug);
  if (!curso) notFound();

  const matricula = await minhaMatricula(curso.id);
  const mods = await modulosComProgresso(curso.id, matricula?.id ?? null);
  const m = mods.find((x) => x.ordem === ordem);
  if (!m) notFound();

  const aulas = await aulasDoModulo(m.id);
  const anterior = mods.find((x) => x.ordem === ordem - 1);
  const proximo = mods.find((x) => x.ordem === ordem + 1);

  return (
    <>
      <header className="mb-6">
        <p className="acad-eyebrow">Módulo {m.ordem}{m.tempo_label ? ` · ${m.tempo_label}` : ""}</p>
        <h1 className="acad-h1">{m.titulo}</h1>
        {m.objetivo && <p className="acad-sub">{m.objetivo}</p>}
      </header>

      <div className="space-y-4">
        {aulas.map((a) => (
          <BlocoAula key={a.id} b={{ ...(a.corpo as Record<string, unknown>), tipo: a.tipo, titulo: a.titulo } as Bloco} />
        ))}
      </div>

      {m.tarefas.length > 0 && (
        <div className="acad-card mt-6 p-5">
          <h3 className="text-[15px] font-semibold text-[color:var(--navy)]">Tarefas deste módulo</h3>
          <p className="mt-1 text-[12px] text-[color:var(--acad-muted)]">
            {matricula
              ? "Marcar as tarefas é o que registra seu avanço na trilha."
              : "Você está visualizando sem matrícula, então o avanço não é gravado."}
          </p>
          <ul className="mt-3 space-y-2">
            {m.tarefas.map((t) => (
              <li key={t.id}>
                {matricula ? (
                  <form action={(t.feita ? desmarcarTarefa : marcarTarefa).bind(null, matricula.id, t.id, slug)}>
                    <button
                      className="ds-focus flex w-full items-start gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-[#F0F3F7]"
                      aria-pressed={t.feita}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] ${
                          t.feita ? "border-[color:var(--cyan)] bg-[var(--cyan)] text-white" : "border-[color:var(--acad-border)]"
                        }`}
                      >
                        {t.feita ? "✓" : ""}
                      </span>
                      <span className={`text-[13px] ${t.feita ? "text-[color:var(--acad-muted)] line-through" : "text-[color:var(--acad-text)]"}`}>
                        {t.texto}
                      </span>
                    </button>
                  </form>
                ) : (
                  <span className="flex items-start gap-2.5 px-2 py-1.5 text-[13px] text-[color:var(--acad-text)]">
                    <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-[4px] border border-[color:var(--acad-border)]" />
                    {t.texto}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <nav className="mt-6 flex items-center justify-between gap-3">
        {anterior ? (
          <Link href={`/academy/trilha/${slug}/${anterior.ordem}`} className="ds-focus text-[13px] text-[color:var(--acad-text)] hover:text-[color:var(--navy)]">
            ← {anterior.titulo}
          </Link>
        ) : <span />}
        {proximo ? (
          <Link href={`/academy/trilha/${slug}/${proximo.ordem}`} className="ds-focus text-[13px] font-medium text-[color:var(--cyan2)]">
            {proximo.titulo} →
          </Link>
        ) : (
          <Link href={`/academy/trilha/${slug}`} className="ds-focus text-[13px] font-medium text-[color:var(--cyan2)]">
            Voltar à trilha →
          </Link>
        )}
      </nav>
    </>
  );
}
