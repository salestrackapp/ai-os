import { createClient } from "@/lib/supabase/server";
import { Referencias, type RefItem } from "@/components/academy/Referencias";

export const dynamic = "force-dynamic";

/** Biblioteca de Recursos — as cinco abas da academy antiga, no design system da Salestrack. */
export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const sb = await createClient();
  const [{ data }, { data: estado }] = await Promise.all([
    sb.from("academy_referencias")
      .select("id, tipo, nome, categoria, icone, cor, conteudo, impacto, ferramentas, sistema, parametros, retorno, termo_en, exemplo, risco")
      .is("deleted_at", null)
      .order("tipo")
      .order("ordem"),
    // A RLS já limita a linha ao próprio aluno — o maybeSingle é só porque pode não existir ainda.
    sb.from("academy_tool_state").select("dados").eq("chave", "checklist_seguranca").maybeSingle(),
  ]);

  return (
    <>
      <header className="mb-6">
        <p className="acad-eyebrow">Salestrack AI Academy</p>
        <h1 className="acad-h1">Biblioteca de Recursos</h1>
        <p className="acad-sub">Prompts prontos, ferramentas descritas, checklist de segurança, glossário e a calculadora de retorno.</p>
      </header>
      <Referencias itens={(data ?? []) as RefItem[]} abaInicial={aba}
        checklistMarcado={(estado?.dados ?? {}) as Record<string, boolean>} />
    </>
  );
}
