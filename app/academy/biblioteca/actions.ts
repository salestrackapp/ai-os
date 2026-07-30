"use server";
import { createClient } from "@/lib/supabase/server";

/**
 * Estado pessoal das ferramentas — hoje só as marcações do checklist de segurança.
 *
 * Na academy antiga isso vivia em localStorage: sumia ao trocar de máquina ou limpar o navegador.
 * Aqui segue a conta. A RLS de academy_tool_state já restringe a linha ao próprio usuário,
 * então não há checagem manual de posse; só o user_id do lado do servidor, nunca do cliente.
 */
export async function salvarEstadoFerramenta(chave: "checklist_seguranca", dados: Record<string, boolean>) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");

  const { error } = await sb.from("academy_tool_state")
    .upsert({ user_id: user.id, chave, dados, updated_at: new Date().toISOString() },
      { onConflict: "user_id,chave" });
  if (error) throw new Error(error.message);
}
