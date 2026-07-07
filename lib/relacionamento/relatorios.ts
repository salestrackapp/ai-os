import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getNumber } from "@/lib/settings/resolve";
import { requireTeam } from "./inbox";
import { isSlaBreached, type ConvStatus, type Channel } from "./types";

export type Relatorio = {
  total: number;
  porCanal: { email: number; whatsapp: number };
  porStatus: Record<ConvStatus, number>;
  naoLidas: number;
  atrasadas: number;
  slaHoras: number;
  workload: { userId: string | null; email: string; abertas: number; total: number }[];
  tempoRespostaMedioHoras: number | null;   // 1ª resposta (out após 1º in)
  amostraResposta: number;                   // nº de conversas na amostra
};

const STATUSES: ConvStatus[] = ["aberta", "aguardando", "respondida", "arquivada"];

/** Relatório de relacionamento (read-only, cross-canal). Números batem com os dados do E0–E4. */
export async function buildRelatorio(): Promise<Relatorio> {
  await requireTeam();
  const sb = createServiceClient();
  const nowISO = new Date().toISOString();
  const slaHoras = (await getNumber("rel_sla_horas")) ?? 24;

  const [{ data: convs }, { data: membros }] = await Promise.all([
    sb.from("rel_conversas").select("id, channel, status, assigned_to, unread, last_message_at").is("deleted_at", null).limit(5000),
    sb.from("memberships").select("user_id, email").eq("role", "salestrack_admin"),
  ]);
  const lista = convs ?? [];
  const nomeMembro = (id: string | null) => (membros ?? []).find((m) => m.user_id === id)?.email ?? "não atribuídas";

  const porStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ConvStatus, number>;
  const porCanal = { email: 0, whatsapp: 0 };
  const workloadMap = new Map<string | null, { abertas: number; total: number }>();
  let naoLidas = 0, atrasadas = 0;

  for (const c of lista) {
    porStatus[c.status as ConvStatus] = (porStatus[c.status as ConvStatus] ?? 0) + 1;
    if ((c.channel as Channel) === "whatsapp") porCanal.whatsapp++; else porCanal.email++;
    if (c.unread) naoLidas++;
    if (isSlaBreached({ status: c.status as ConvStatus, last_message_at: c.last_message_at }, slaHoras, nowISO)) atrasadas++;
    const cur = workloadMap.get(c.assigned_to) ?? { abertas: 0, total: 0 };
    cur.total++;
    if (["aberta", "aguardando"].includes(c.status)) cur.abertas++;
    workloadMap.set(c.assigned_to, cur);
  }
  const workload = [...workloadMap.entries()]
    .map(([userId, v]) => ({ userId, email: nomeMembro(userId), abertas: v.abertas, total: v.total }))
    .sort((a, b) => b.abertas - a.abertas);

  // Tempo até a 1ª resposta: primeira msg out após a primeira msg in de cada conversa.
  const { data: msgs } = await sb.from("rel_mensagens").select("conversa_id, direction, created_at").order("created_at", { ascending: true }).limit(8000);
  const firstIn = new Map<string, number>(), firstOutAfter = new Map<string, number>();
  for (const mm of msgs ?? []) {
    const t = new Date(mm.created_at).getTime();
    if (mm.direction === "in" && !firstIn.has(mm.conversa_id)) firstIn.set(mm.conversa_id, t);
    if (mm.direction === "out" && firstIn.has(mm.conversa_id) && !firstOutAfter.has(mm.conversa_id) && t >= (firstIn.get(mm.conversa_id) ?? 0)) firstOutAfter.set(mm.conversa_id, t);
  }
  const deltas: number[] = [];
  for (const [cid, tIn] of firstIn) { const tOut = firstOutAfter.get(cid); if (tOut) deltas.push((tOut - tIn) / 3600000); }
  const tempoRespostaMedioHoras = deltas.length ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10 : null;

  return { total: lista.length, porCanal, porStatus, naoLidas, atrasadas, slaHoras, workload, tempoRespostaMedioHoras, amostraResposta: deltas.length };
}
