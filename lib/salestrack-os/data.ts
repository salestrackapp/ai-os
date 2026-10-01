import "server-only";
import { rotaNextSteps, type RotaAnswers } from "./rota";
import { googleConfigured } from "@/lib/google";
import { zapiConfigured } from "@/lib/whatsapp";
import { docusignConfigured } from "@/lib/docusign";
import { createServiceClient } from "@/lib/supabase/service";
import { getSecret } from "@/lib/settings/secrets";
import {
  buildRoutine,
  brasiliaDay,
  type DealInput,
  type TaskInput,
  type Progress,
} from "./model";
const PREFIX = "salestrack_os:progress:";
export async function loadCentral() {
  const sb = createServiceClient();
  const day = brasiliaDay();
  const [d, t, s, apolloSecret] = await Promise.all([
    sb
      .from("deals")
      .select("id,title,stage,score,last_activity_at")
      .is("deleted_at", null)
      .not("stage", "in", "(cliente,perdido)")
      .order("last_activity_at", { ascending: true, nullsFirst: true })
      .limit(100),
    sb
      .from("tasks")
      .select("id,title,due_date")
      .eq("done", false)
      .not("due_date", "is", null)
      .order("due_date")
      .limit(100),
    sb
      .from("app_settings")
      .select("key,value")
      .or(`key.like.${PREFIX}backlog:%,key.like.${PREFIX}day:${day}:%`)
      .limit(1000),
    getSecret("apollo"),
  ]);
  for (const r of [d, t, s])
    if (r.error)
      throw new Error(
        "Não foi possível ler a base. Nenhum resultado foi presumido.",
      );
  const progress: Record<string, Progress> = {};
  for (const row of s.data || [])
    progress[row.key.slice(PREFIX.length)] = row.value as Progress;
  const integrations = [
    {
      name: "Apollo",
      configured: !!apolloSecret,
      manual: "/admin/crm/importar",
    },
    {
      name: "Claude",
      configured: !!process.env.ANTHROPIC_API_KEY,
      manual: "/admin/configuracoes/parametros",
    },
    {
      name: "Gmail",
      configured: await googleConfigured(),
      manual: "/admin/relacionamento",
    },
    {
      name: "Resend",
      configured: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
      manual: "/admin/configuracoes/parametros",
    },
    {
      name: "DocuSign",
      configured:
        docusignConfigured(),
      manual: "/admin/contratos",
    },
    {
      name: "WhatsApp",
      configured: await zapiConfigured(),
      manual: "/admin/configuracoes/parametros",
    },
  ];
  const rotaRecords: Record<string,RotaAnswers> = {};
  if(d.data?.length){
    const r=await sb.from("app_settings").select("key,value").in("key",d.data.map(x=>`salestrack_os:rota:${x.id}`));
    if(r.error) throw Error("Falha ao ler diagnósticos ROTA.");
    for(const row of r.data||[]) rotaRecords[row.key.replace("salestrack_os:rota:","")]=row.value?.answers||{};
  }
  const rota=rotaNextSteps(d.data||[],rotaRecords);
  const items = buildRoutine(
    day,
    (d.data || []) as DealInput[],
    (t.data || []) as TaskInput[],
    progress,
  );
  for(const r of rota) items.push({
    id:`rota-${r.deal.id}`, title:`ROTA · ${r.deal.title}`, area:"vendas",priority:35,
    agent:"Diagnóstico ROTA",minutes:15,href:`/admin/rota?deal=${r.deal.id}`,
    trigger:`${r.missing.length} campos ainda sem registro.`,
    steps:[`Confirmar com o cliente: ${r.missing[0].label}.`,"Registrar a fonte e distinguir informação confirmada de hipótese.","Salvar o diagnóstico e combinar próximo passo com responsável e data."],
    proof:"Diagnóstico salvo com evidência e próximo passo combinado.",
  });
  items.sort((a,b)=>a.priority-b.priority);
  return {
    rota,
    day,
    items,
    progress,
    integrations,
    coverage: {
      deals: d.data?.length || 0,
      tasks: t.data?.length || 0,
      limit: 100,
    },
    loadedAt: new Date().toISOString(),
  };
}
export async function saveDailyPlan() {
  const central = await loadCentral(),
    sb = createServiceClient();
  const key = `salestrack_os:plan:${central.day}`;
  const r = await sb
    .from("app_settings")
    .upsert(
      {
        key,
        value: {
          day: central.day,
          items: central.items,
          generatedAt: central.loadedAt,
        },
        updated_at: central.loadedAt,
      },
      { onConflict: "key", ignoreDuplicates: true },
    );
  if (r.error) throw Error("Plano não foi salvo.");
  return { day: central.day, items: central.items.length, sends: 0 };
}
export { PREFIX };
