"use server";
import { exigirAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { rotaSchema } from "@/lib/salestrack-os/rota";
import { revalidatePath } from "next/cache";
export async function saveRota(raw:unknown) {
 const m=await exigirAdmin(); const v=rotaSchema.parse(raw); const sb=createServiceClient();
 const deal=await sb.from("deals").select("id").eq("id",v.dealId).is("deleted_at",null).maybeSingle();
 if(deal.error||!deal.data) throw Error("Negócio indisponível. Atualize a página.");
 const key=`salestrack_os:rota:${v.dealId}`; const now=new Date().toISOString();
 const row={key,value:{answers:v.answers,actor:m.userId},updated_at:now};
 const r=v.revision ? await sb.from("app_settings").update(row).eq("key",key).eq("updated_at",v.revision).select("updated_at") : await sb.from("app_settings").insert(row).select("updated_at");
 if(r.error||!r.data?.length) throw Error("Não foi salvo. O registro pode ter sido alterado em outra aba; recarregue antes de tentar novamente.");
 revalidatePath("/admin/rota"); return {revision:r.data[0].updated_at as string};
}
