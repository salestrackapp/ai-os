"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {searchTools} from "@/lib/admin/workspaces";
export function QuickSearch(){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [query,setQuery]=useState("");const path=usePathname();
 function close(){dialog.current?.close();trigger.current?.focus();}
 function open(){setQuery("");dialog.current?.showModal();input.current?.focus();}
 useEffect(()=>{const listener=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if(dialog.current?.open){dialog.current.close();trigger.current?.focus();}else{setQuery("");dialog.current?.showModal();input.current?.focus();}}};window.addEventListener("keydown",listener);return()=>window.removeEventListener("keydown",listener);},[]);
 useEffect(()=>{dialog.current?.close();},[path]);
 const results=searchTools(query).slice(0,10);
 return <><button ref={trigger} type="button" onClick={open} className="rounded-lg border border-white/25 px-3 py-2 text-sm text-white" aria-label="Buscar ferramenta (Control ou Command K)">Buscar <span className="hidden sm:inline">⌘ / Ctrl K</span></button>
 <dialog ref={dialog} aria-label="Busca rápida de ferramentas" className="w-[min(94vw,640px)] max-h-[85dvh] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-950/60" onClick={e=>{if(e.target===dialog.current)close();}}>
 <div className="p-5" onClick={e=>e.stopPropagation()}><div className="flex items-center gap-3"><h2 className="text-lg font-semibold">O que você precisa fazer?</h2><button type="button" onClick={close} className="ml-auto rounded border px-3 py-2 text-sm">Fechar</button></div>
 <label className="mt-4 block text-sm">Buscar por nome, tarefa ou área<input ref={input} value={query} onChange={e=>setQuery(e.target.value)} className="mt-2 w-full rounded-lg border p-3" placeholder="CRM, contatos, proposta, IA…" type="search"/></label>
 <p role="status" className="my-3 text-xs text-slate-500">{results.length?"Até 10 atalhos. Use Tab para escolher e Enter para abrir.":"Nenhum resultado. Tente outro termo."}</p>
 <div className="max-h-[45dvh] overflow-y-auto">{results.map(s=><Link key={s.href} href={s.href} onClick={close} className="block rounded-lg p-3 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600"><span className="block font-medium">{s.label}</span><span className="text-xs text-slate-500">{s.workspace} · {s.group}</span></Link>)}</div><Link href="/admin/ferramentas" onClick={close} className="mt-3 block border-t pt-3 text-sm underline">Ver todas as ferramentas</Link></div></dialog></>;
}
