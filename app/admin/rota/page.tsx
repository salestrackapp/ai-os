import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { RotaEditor } from "@/components/salestrack-os/RotaEditor";
import { z } from "zod";
export const dynamic="force-dynamic";
export default async function RotaPage({searchParams}:{searchParams:Promise<{deal?:string}>}) {
 await exigirAdmin(); const {deal}=await searchParams;const sb=createServiceClient();
 const list=await sb.from("deals").select("id,title,stage").is("deleted_at",null).order("last_activity_at",{ascending:false,nullsFirst:false}).limit(100);
 if(list.error) throw Error("Não foi possível carregar os negócios.");
 let selected=null,record=null;
 if(deal&&z.string().uuid().safeParse(deal).success){const d=await sb.from("deals").select("id,title").eq("id",deal).is("deleted_at",null).maybeSingle();if(d.error) throw Error("Falha ao ler negócio.");selected=d.data;
 if(selected){const r=await sb.from("app_settings").select("value,updated_at").eq("key",`salestrack_os:rota:${deal}`).maybeSingle();if(r.error) throw Error("Falha ao ler diagnóstico.");record=r.data;}}
 return <main className="mx-auto max-w-5xl p-6"><Link href="/admin/central" className="text-sm underline">Voltar ao meu dia</Link><h1 className="mt-5 text-3xl font-bold">Método ROTA</h1><p className="my-4 leading-7">Da prioridade empresarial à implementação e evolução. Aplique em Vendas, Marketing, Financeiro, Operações, Atendimento, Pessoas e Gestão.</p>
 {selected?<><h2 className="my-6 text-xl font-semibold">{selected.title}</h2><RotaEditor key={selected.id} dealId={selected.id} title={selected.title} initial={record?.value?.answers||{}} revision={record?.updated_at||null}/></>:<><p className="my-5">Selecione um negócio para registrar o diagnóstico. Exibindo até 100 negócios recentes.</p><div className="grid gap-3">{list.data?.map(d=><Link className="card p-4" href={`/admin/rota?deal=${d.id}`} key={d.id}>{d.title} <span className="text-sm text-muted">· {d.stage}</span></Link>)}{!list.data?.length&&<Link href="/admin/crm" className="underline">Cadastre o primeiro negócio no CRM</Link>}</div></>}
 </main>;
}
