"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ROTA, rotaReadiness, rotaHandoff, type RotaAnswers } from "@/lib/salestrack-os/rota";
import { saveRota } from "@/app/admin/rota/actions";
export function RotaEditor({dealId,title,initial,revision:original}:{dealId:string;title:string;initial:RotaAnswers;revision:string|null}) {
 const [answers,setAnswers]=useState(initial),[revision,setRevision]=useState(original),[message,setMessage]=useState(""),[pending,start]=useTransition();
 const readiness=rotaReadiness(answers); const missing=readiness.flatMap(s=>s.missing);
 return <form onSubmit={e=>{e.preventDefault();start(async()=>{try { const r=await saveRota({dealId,answers,revision});setRevision(r.revision);setMessage("Diagnóstico salvo."); }catch(e){setMessage(e instanceof Error?e.message:"Falha ao salvar.");}});}} className="space-y-5">
 <div className="rounded-xl border p-4 text-sm"><b>{12-missing.length}/12 campos preenchidos</b><p>{missing.length?`Próxima pergunta: ${missing[0].label}`:"Campos preenchidos. Confirme evidências e aceite com o cliente antes de avançar."}</p><p className="mt-2">Preenchimento orienta a preparação; não certifica resultado ou aprovação.</p></div>
 {ROTA.map((s,i)=><fieldset key={s.key} className="card p-5"><legend className="px-2 text-lg font-semibold">{i+1}. {s.name}</legend><p className="mb-4 text-sm">{s.question}</p><div className="grid gap-4">{s.fields.map(f=><label key={f.key} className="block text-sm">{f.label}<textarea className="mt-2 block w-full rounded-lg border bg-white p-3 text-slate-900" rows={3} maxLength={4000} value={answers[f.key]||""} onChange={e=>setAnswers({...answers,[f.key]:e.target.value})}/></label>)}</div></fieldset>)}
 <div className="flex flex-wrap items-center gap-4"><button disabled={pending} className="rounded-lg bg-slate-900 px-5 py-3 text-white disabled:opacity-50">{pending?"Salvando…":"Salvar diagnóstico"}</button><Link className="underline" href={`/admin/crm/${dealId}`}>Abrir negócio</Link><Link className="underline" href="/admin/propostas">Preparar proposta</Link><Link className="underline" href="/admin/entregas">Planejar entregas</Link></div>
 <p role="status" aria-live="polite">{message}</p>
 <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Resumo para proposta e passagem ao projeto</summary><p className="my-3 text-sm">Copie o resumo revisado para o escopo da proposta ou briefing do projeto. Nenhum documento é enviado por esta tela.</p><textarea readOnly aria-label="Resumo ROTA" className="w-full rounded border p-3 text-sm" rows={14} value={rotaHandoff(title,answers)}/></details>
 </form>;
}
