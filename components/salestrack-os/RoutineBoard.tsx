"use client";
import {useState} from "react";
import {ProgressEditor} from "./ProgressEditor";
import {progressKey,type Item,type Progress} from "@/lib/salestrack-os/model";
export function RoutineBoard({items,progress,day}:{items:Item[];progress:Record<string,Progress>;day:string}){
 const [filter,setFilter]=useState("abertas"),[limit,setLimit]=useState(6),[saved,setSaved]=useState<Record<string,Progress["status"]>>({});
 const status=(i:Item)=>saved[i.id]||progress[progressKey(day,i)]?.status||"pendente";
 const done=items.filter(i=>status(i)==="concluido").length;
 const rows=items.filter(i=>filter==="todas"||filter==="concluidas"?filter==="todas"||status(i)==="concluido":filter==="bloqueadas"?status(i)==="bloqueado":status(i)!=="concluido");
 return <><div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><p className="text-sm" role="status"><b>{items.length-done}</b> abertas · <b>{done}</b> concluídas</p><label className="text-sm">Mostrar <select aria-label="Filtrar atividades" className="ml-2 rounded border bg-white p-2" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(6);}}><option value="abertas">Abertas</option><option value="bloqueadas">Bloqueadas</option><option value="concluidas">Concluídas</option><option value="todas">Todas</option></select></label></div>
 {!rows.length&&<p className="rounded-xl border p-5 text-sm">Nenhuma atividade neste filtro. Consulte as outras listas ou o CRM para novas demandas.</p>}
 <div className="space-y-3">{rows.slice(0,limit).map((item,index)=><details className="rounded-xl border border-slate-200 bg-white p-4" key={item.id}>
 <summary className="cursor-pointer"><span className="text-xs uppercase tracking-wide text-slate-500">{item.agent} · {item.minutes} min · {status(item).replaceAll("_"," ")}</span><span className="mt-1 block text-base font-semibold text-slate-900">{index+1}. {item.title}</span></summary>
 <div className="mt-4 border-t pt-4"><p className="text-sm text-slate-600">{item.trigger}</p><ol className="my-4 list-decimal space-y-2 pl-5 text-sm leading-6">{item.steps.map(s=><li key={s}>{s}</li>)}</ol><p className="text-sm"><b>Concluir quando:</b> {item.proof}</p><a className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" href={item.href} target={item.href.startsWith("https")?"_blank":undefined} rel="noopener noreferrer">Abrir etapa</a><ProgressEditor day={day} id={item.id} initial={progress[progressKey(day,item)]} onSaved={s=>setSaved(v=>({...v,[item.id]:s}))}/></div>
 </details>)}</div>
 {rows.length>limit&&<button className="mt-4 rounded-lg border px-4 py-2 text-sm" onClick={()=>setLimit(l=>l+6)}>Mostrar mais {Math.min(6,rows.length-limit)} atividades ({rows.length-limit} restantes)</button>}</>;
}
