import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadCentral } from "@/lib/salestrack-os/data";
import {
  AGENTS,
  BACKLOG,
  POSITIONING,
} from "@/lib/salestrack-os/model";
import { RoutineBoard } from "@/components/salestrack-os/RoutineBoard";
import { DailyActions } from "@/components/salestrack-os/DailyActions";
export const dynamic = "force-dynamic";
export default async function Central() {
  await exigirAdmin();
  let data;
  try {
    data = await loadCentral();
  } catch {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">
          Salestrack OS · Central Comercial
        </h1>
        <p className="my-4">
          Não foi possível ler o banco. A fila não representa zero
          oportunidades.
        </p>
        <a
          className="btn-gold"
          href="https://supabase.com/dashboard/project/maazgvwbcszcsjsvqnnf"
        >
          Verificar banco
        </a>
        <p className="mt-5">
          Enquanto isso: consulte a planilha, registre ações e bloqueios
          manualmente e retome a importação depois da restauração.
        </p>
      </main>
    );
  }
  const { data: brief } = await createServiceClient()
    .from("app_settings")
    .select("value")
    .eq("key", `salestrack_os:briefing:${data.day}`)
    .maybeSingle();
  return (
    <main className="mx-auto max-w-7xl p-5 md:p-8">
      <p className="text-xs uppercase tracking-widest text-muted">
        Salestrack OS · {data.day} · Brasília
      </p>
      <h1 className="mt-3 text-2xl font-bold md:text-3xl">
        O que precisa de você para vender.
      </h1>
      <p className="my-4 max-w-4xl text-sm leading-7 text-muted">
        {POSITIONING}
      </p>
      <nav className="mb-6 flex flex-wrap gap-4 text-sm font-semibold">
        <a href="#rotina">Rotina</a>
        <a href="#evolucao">Pendências</a>
        <a href="#agentes">Agentes</a>
        <a href="#integracoes">Integrações</a>
        <Link href="/admin/crm">Funil</Link>
        <Link href="/admin/rota">Diagnóstico ROTA</Link>
        <Link href="/admin/propostas">Propostas</Link>
        <Link href="/admin/entregas">Projetos e entregas</Link>
      </nav>
      <DailyActions initialBriefing={brief?.value?.text || ""} />
      <div className="mb-5 rounded-lg border p-4 text-sm leading-6">
        A rotina combina regras de prioridade e registros do CRM. A IA prepara
        recomendações; esta central não envia mensagens. Concluir aqui registra
        andamento, sem alterar automaticamente o negócio ou a tarefa de origem.
        Cobertura: até {data.coverage.limit} negócios abertos e{" "}
        {data.coverage.limit} tarefas mais antigas por leitura.
      </div>
      <section id="rotina">
        <h2 className="mb-4 text-xl font-semibold">
          Rotina do dia e duas melhorias prioritárias
        </h2>
        <RoutineBoard day={data.day} items={data.items} progress={data.progress}/>
      </section>
      <section id="evolucao" className="mt-10">
        <h2 className="text-xl font-semibold">Pendências e próximos passos</h2>
        <p className="my-3 text-sm text-muted">
          As duas primeiras pendências abertas entram na rotina diária. Marcar
          como concluída exige evidência; configuração não equivale a teste
          aprovado.
        </p>
        <RoutineBoard day={data.day} items={BACKLOG.filter(b=>!data.items.some(i=>i.id===b.id))} progress={data.progress}/>
      </section>
      <section id="agentes" className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">
          Responsabilidades dos agentes
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {AGENTS.map((a) => (
            <Link className="card p-4" href={a.href} key={a.key}>
              <h3 className="font-semibold">{a.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{a.output}</p>
              <p className="mt-3 text-xs">Abrir fila de trabalho</p>
            </Link>
          ))}
        </div>
      </section>
      <section id="integracoes" className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Integrações do sistema</h2>
        <p className="mb-4 text-sm text-muted">
          Este indicador verifica presença de configuração. Credenciais,
          permissões, recebimento e envio exigem teste real. Plugins conectados
          no ChatGPT não ativam o app automaticamente.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {data.integrations.map((i) => (
            <div className="card p-4" key={i.name}>
              <h3 className="font-semibold">{i.name}</h3>
              <p className="my-2 text-sm">
                {i.configured
                  ? "Configuração encontrada · teste pendente"
                  : "Configuração pendente · seguir procedimento manual"}
              </p>
              <Link className="text-sm underline" href={i.manual}>
                Abrir configuração ou operação manual
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
