import Link from "next/link";
import {ContentArea,PageHeader} from "@/components/ds";
import {AREAS,type AreaKey} from "@/lib/admin/nav";
import {WORKSPACES} from "@/lib/admin/workspaces";
export function AreaIndex({area}:{area:AreaKey}){
 const old=AREAS.find(a=>a.key===area)!;
 const workspace=WORKSPACES.find(w=>w.key===(area==="estudio"?"conteudo":area==="comercial"?"crm":area));
 const groups=workspace?.groups||[{label:old.label,items:old.sections}];
 return <ContentArea><PageHeader title={workspace?.label||old.label} subtitle="Escolha a tarefa. As ferramentas estão organizadas por etapa de trabalho." actions={old.primary&&<Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" href={old.primary.href}>{old.primary.label}</Link>}/>
 {groups.map(g=><section className="mb-8" key={g.label}><h2 className="mb-3 text-lg font-semibold">{g.label}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{g.items.map(s=><Link className="rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600" key={s.href} href={s.href}><h3 className="text-base font-semibold">{s.label}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{s.desc}</p></Link>)}</div></section>)}</ContentArea>;
}
