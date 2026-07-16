"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";

/** Marca/desmarca um módulo como concluído (público, via token — token é o segredo). Progresso por org do entregável. */
export async function marcarModuloAction(token: string, deliverableId: string, orgId: string, moduleIndex: number, concluir: boolean) {
  const sb = createServiceClient();
  // valida que o token pertence ao entregável (não confia no client)
  const { data: d } = await sb.from("studio_deliverables").select("id, org_id").eq("public_token", token).maybeSingle();
  if (!d || d.id !== deliverableId || d.org_id !== orgId) return;
  if (concluir) {
    await sb.from("deliverable_progress").upsert(
      { deliverable_id: deliverableId, subject_type: "org", subject_id: orgId, module_index: moduleIndex, done_at: new Date().toISOString() },
      { onConflict: "deliverable_id,subject_type,subject_id,module_index" },
    );
  } else {
    await sb.from("deliverable_progress").delete().eq("deliverable_id", deliverableId).eq("subject_type", "org").eq("subject_id", orgId).eq("module_index", moduleIndex);
  }
  revalidatePath(`/entregavel/${token}`);
}
