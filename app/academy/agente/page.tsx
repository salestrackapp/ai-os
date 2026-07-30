import { createClient } from "@/lib/supabase/server";
import { CriadorAgente } from "@/components/academy/CriadorAgente";
import { completarDados } from "@/lib/academy/builder";
import type { FerramentaRef } from "@/lib/academy/builder";

export const dynamic = "force-dynamic";

/**
 * O catálogo de ferramentas vem da biblioteca de referências — a mesma que o André edita.
 * Cadastrar uma ferramenta nova lá faz ela aparecer aqui, sem tocar em código.
 */
export default async function AgentePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const sb = await createClient();
  const [{ data: ferramentas }, { data: prompts }] = await Promise.all([
    sb.from("academy_referencias").select("chave, nome, parametros, conteudo, retorno, categoria")
      .eq("tipo", "ferramenta").is("deleted_at", null).order("ordem"),
    sb.from("academy_referencias").select("categoria").eq("tipo", "prompt").is("deleted_at", null),
  ]);

  const areas = [...new Set((prompts ?? []).map((p) => p.categoria).filter(Boolean))].sort() as string[];

  // Abrir um agente salvo da barra lateral. A RLS de academy_agents já limita ao dono,
  // então um id de outra pessoa simplesmente não retorna linha.
  const { data: salvo } = id
    ? await sb.from("academy_agents").select("id, dados").eq("id", id).is("deleted_at", null).maybeSingle()
    : { data: null };

  return (
    <>
      <header className="mb-6">
        <p className="acad-eyebrow">Salestrack AI Academy</p>
        <h1 className="acad-h1">{salvo ? "Editar agente" : "Criador de Agentes"}</h1>
        <p className="acad-sub">{salvo
          ? "Ajuste as respostas e salve. As instruções são geradas de novo automaticamente."
          : "Responda as perguntas dos cinco passos. O sistema monta as instruções do agente prontas para copiar e usar — você não precisa escrever nada técnico."}</p>
      </header>
      <CriadorAgente
        catalogo={(ferramentas ?? []).map((f) => ({
          chave: f.chave, nome: f.nome, parametros: f.parametros ?? "",
          conteudo: f.conteudo ?? "", retorno: f.retorno ?? "", categoria: f.categoria ?? "Outras",
        })) as (FerramentaRef & { categoria: string })[]}
        areas={areas}
        agente={salvo ? { id: salvo.id, dados: completarDados(salvo.dados) } : null}
      />
    </>
  );
}
