"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {activeTool,workspaceForPath} from "@/lib/admin/workspaces";
export function WorkspaceNav(){const path=usePathname(),w=workspaceForPath(path),active=activeTool(path);if(!w)return null;
 return <div className="border-b border-slate-200 bg-white px-5 py-3 sm:px-8">
 <p className="mb-2 text-xs text-slate-500">{w.label}{active&&active.label!==w.label?` / ${active.label}`:""}</p>
 <nav aria-label={`Seções de ${w.label}`} className="flex flex-wrap gap-2">
 {w.groups.map(g=>w.key==="crm" && g.label==="Base e funil" ? <div key={g.label} className="flex flex-wrap gap-1">{g.items.map(s=><Link key={s.href} href={s.href} aria-current={active?.href===s.href?"page":undefined} className={`rounded-lg px-3 py-2 text-sm ${active?.href===s.href?"bg-sky-100 font-semibold text-sky-900":"text-slate-700 hover:bg-slate-100"}`}>{s.label}</Link>)}</div> : <details name="workspace-sections" onKeyDown={e=>{if(e.key==="Escape"){e.currentTarget.open=false;e.currentTarget.querySelector("summary")?.focus();}}} key={`${path}:${g.label}`} className="relative max-sm:w-full rounded-lg border border-slate-200 bg-white">
 <summary className={`cursor-pointer px-3 py-2 text-sm ${g.items.some(s=>s.href===active?.href)?"font-semibold text-sky-900 bg-sky-50 rounded-lg":"text-slate-700"}`}>{g.label}</summary>
 <div className="sm:absolute left-0 top-full z-40 mt-1 sm:w-60 max-w-[80vw] rounded-lg border bg-white p-1 shadow-lg">{g.items.map(s=><Link key={s.href} href={s.href} aria-current={active?.href===s.href?"page":undefined} className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600">{s.label}</Link>)}</div>
 </details>)}
 </nav></div>;
}
