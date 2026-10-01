"use client";
import {useState} from "react";
import Link from "next/link";
import {AREAS} from "@/lib/admin/nav";
export function ToolDirectory(){const [q,setQ]=useState("");const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();const rows=AREAS.flatMap(a=>a.sections.map(s=>({...s,area:a.label}))).filter(s=>norm(`${s.area} ${s.label} ${s.desc}`).includes(norm(q)));return <><label className="block my-5">Buscar ferramenta<input type="search" className="mt-2 block w-full rounded-lg border p-3" placeholder="Ex.: propostas, tarefas, Apollo, contratos" value={q} onChange={e=>setQ(e.target.value)}/></label><p className="mb-4 text-sm" role="status">{rows.length} ferramentas</p><div className="grid gap-3 md:grid-cols-2">{rows.map(s=><Link className="card p-4" href={s.href} key={s.href}><span className="text-xs text-muted">{s.area}</span><h2 className="font-semibold">{s.label}</h2><p className="text-sm mt-2">{s.desc}</p></Link>)}</div></>}
