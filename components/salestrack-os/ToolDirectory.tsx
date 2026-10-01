"use client";
import {useState} from "react";
import Link from "next/link";
import {WORKSPACES,searchTools} from "@/lib/admin/workspaces";
export function ToolDirectory(){
 const [q,setQ]=useState(""),[area,setArea]=useState("");const rows=searchTools(q,area);
 return <><div className="my-5 grid gap-3 md:grid-cols-[1fr_240px]"><label>Buscar ferramenta<input type="search" className="mt-2 block w-full rounded-lg border p-3 text-sm" placeholder="Ex.: empresas, propostas, Apollo, contratos" value={q} onChange={e=>setQ(e.target.value)}/></label><label>Área<select className="mt-2 block w-full rounded-lg border bg-white p-3 text-sm" value={area} onChange={e=>setArea(e.target.value)}><option value="">Todas as áreas</option>{WORKSPACES.map(w=><option key={w.key} value={w.key}>{w.label}</option>)}</select></label></div>
 <p className="mb-4 text-sm" role="status">{rows.length} ferramentas encontradas</p>
 {!rows.length&&<div className="rounded-lg border p-5"><p>Nenhuma ferramenta encontrada. Tente outro termo ou escolha todas as áreas.</p><button className="mt-3 underline" onClick={()=>{setQ("");setArea("");}}>Limpar filtros</button></div>}
 {WORKSPACES.filter(w=>rows.some(s=>s.workspaceKey===w.key)).map(w=><section className="mb-7" key={w.key}><h2 className="mb-3 text-lg font-semibold">{w.label}</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.filter(s=>s.workspaceKey===w.key).map(s=><Link className="rounded-xl border bg-white p-4 hover:border-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600" href={s.href} key={s.href}><span className="text-xs text-slate-500">{s.group}</span><h3 className="font-semibold">{s.label}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{s.desc}</p></Link>)}</div></section>)}</>;
}
