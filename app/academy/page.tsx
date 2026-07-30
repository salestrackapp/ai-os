import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveLearner } from "@/lib/academy/learner";

export const dynamic = "force-dynamic";

/** Início — reprodução fiel da home da academy anterior. */
export default async function AcademyHome() {
  await resolveLearner();
  const sb = await createClient();

  const [{ data: matriculas }, { data: agentes }, { data: refs }] = await Promise.all([
    sb.from("academy_enrollments").select("id, course_id").eq("status", "ativa"),
    sb.from("academy_agents").select("id, nome, area, missao, status").is("deleted_at", null).order("updated_at", { ascending: false }),
    sb.from("academy_referencias").select("tipo").is("deleted_at", null),
  ]);

  const matricula = (matriculas ?? [])[0];
  let modulosOk = 0, modulosTotal = 0;
  if (matricula) {
    const [{ data: mods }, { data: feitas }] = await Promise.all([
      sb.from("academy_modules").select("id, academy_tasks(id)").eq("course_id", matricula.course_id),
      sb.from("academy_progress").select("task_id").eq("enrollment_id", matricula.id).not("task_id", "is", null),
    ]);
    const concluidas = new Set((feitas ?? []).map((p) => p.task_id));
    modulosTotal = (mods ?? []).length;
    modulosOk = (mods ?? []).filter((m) => {
      const ts = (m.academy_tasks as unknown as { id: string }[]) ?? [];
      return ts.length > 0 && ts.every((t) => concluidas.has(t.id));
    }).length;
  }

  const conta = (t: string) => (refs ?? []).filter((r) => r.tipo === t).length;
  const atalhos = [
    { icone: "🤖", cor: "var(--cyan)", titulo: "Criar Agente", desc: "Fluxo em 5 passos. Responda as perguntas — o sistema monta o agente completo para copiar.", href: "/academy/agente" },
    { icone: "🖊️", cor: "var(--purple)", titulo: "System Prompts", desc: `${conta("prompt")} prompts completos em 8 áreas. Copie, adapte e cole no seu Claude.`, href: "/academy/biblioteca?aba=prompt" },
    { icone: "🔧", cor: "var(--amber)", titulo: "Catálogo de Tools", desc: `${conta("ferramenta")} ferramentas descritas. Envie para o desenvolvedor implementar.`, href: "/academy/biblioteca?aba=ferramenta" },
    { icone: "📚", cor: "var(--green)", titulo: "Trilha de Aprendizado", desc: "6 módulos com conteúdo completo, exemplos reais e tarefas práticas.", href: "/academy/trilha" },
    { icone: "📊", cor: "var(--cyan)", titulo: "Calculadora ROI", desc: "Calcule o retorno antes de apresentar para a liderança.", href: "/academy/biblioteca?aba=roi" },
    { icone: "📖", cor: "var(--purple)", titulo: "Glossário", desc: `${conta("termo")} termos essenciais em português com exemplos práticos.`, href: "/academy/biblioteca?aba=termo" },
  ];

  return (
    <>
      <section className="acad-hero">
        <div className="relative z-[1] flex-1">
          <h2>Bem-vindo à <em>Salestrack AI Academy</em></h2>
          <p>O ambiente completo para aprender a montar agentes no Claude — do conceito ao resultado pronto para copiar e usar. Sem código, sem API, sem complicação.</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href="/academy/agente" className="acad-btn-cyan">🤖 Criar meu primeiro agente</Link>
            <Link href="/academy/trilha" className="acad-btn-ghost">📚 Começar a trilha</Link>
          </div>
        </div>
        <span className="acad-hero-img hidden md:block" aria-hidden>🚀</span>
      </section>

      <div className="acad-grid-3">
        {[
          { icone: "🤖", fundo: "rgba(0,180,216,.12)", num: String((agentes ?? []).length), lbl: "Agentes criados" },
          { icone: "📚", fundo: "rgba(16,185,129,.12)", num: modulosTotal ? `${modulosOk}/${modulosTotal}` : "—", lbl: "Módulos concluídos" },
          { icone: "📋", fundo: "rgba(139,92,246,.12)", num: String((refs ?? []).length), lbl: "Referências disponíveis" },
        ].map((s) => (
          <div key={s.lbl} className="acad-stat">
            <span className="acad-stat-icon" style={{ background: s.fundo }} aria-hidden>{s.icone}</span>
            <span>
              <span className="acad-stat-num block">{s.num}</span>
              <span className="acad-stat-lbl block">{s.lbl}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="acad-section-div"><span>Acesso rápido</span></div>
      <div className="acad-grid">
        {atalhos.map((a) => (
          <Link key={a.href} href={a.href} className="block">
            <div className="acad-qa" style={{ borderLeftColor: a.cor }}>
              <span className="acad-qa-icon" aria-hidden>{a.icone}</span>
              <h3>{a.titulo}</h3>
              <p>{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="acad-section-div"><span>Meus agentes</span></div>
      {(agentes ?? []).length === 0 ? (
        <div className="acad-card p-8 text-center">
          <p className="text-[15px] font-bold text-[color:var(--navy)]">Você ainda não criou nenhum agente</p>
          <p className="mt-1 text-[13px] text-[color:var(--acad-muted)]">O criador te guia por cinco passos e entrega o agente pronto para copiar e usar.</p>
          <Link href="/academy/agente" className="acad-btn-cyan mt-4 inline-block">Criar agente</Link>
        </div>
      ) : (
        <div className="acad-grid">
          {(agentes ?? []).map((a) => (
            <Link key={a.id} href={`/academy/agente?id=${a.id}`} className="block">
              <div className="acad-card h-full p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-bold text-[color:var(--navy)]">{a.nome}</p>
                  <span className="acad-badge acad-badge-amber shrink-0 capitalize">{a.status}</span>
                </div>
                {a.area && <p className="mt-0.5 text-[12px] text-[color:var(--acad-muted)]">{a.area}</p>}
                {a.missao && <p className="mt-2 line-clamp-2 text-[13px] text-[color:var(--acad-text)]">{a.missao}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
