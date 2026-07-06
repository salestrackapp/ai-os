import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ConfigLink } from "@/components/config/ConfigLink";
import { PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";

export const dynamic = "force-dynamic";

const CANAL_LABEL: Record<string, string> = { portal: "Portal", whatsapp: "WhatsApp", slack: "Slack" };

export default async function AdminConsultorPage() {
  const supabase = await createClient();
  const { data: convs } = await supabase.from("conversations").select("id, org_id, canal, created_at").order("created_at", { ascending: false }).limit(100);
  const list = (convs ?? []) as { id: string; org_id: string; canal: string; created_at: string }[];
  const ids = list.map((c) => c.id);
  const orgIds = [...new Set(list.map((c) => c.org_id))];

  const [{ data: orgs }, { data: lastMsgs }] = await Promise.all([
    orgIds.length ? supabase.from("organizations").select("id, name").in("id", orgIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ids.length ? supabase.from("messages").select("conversation_id, role, content, created_at").in("conversation_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as { conversation_id: string; role: string; content: string; created_at: string }[] }),
  ]);
  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  const last: Record<string, { content: string; role: string }> = {};
  const msgCount: Record<string, number> = {};
  for (const mm of lastMsgs ?? []) { msgCount[mm.conversation_id] = (msgCount[mm.conversation_id] ?? 0) + 1; if (!last[mm.conversation_id]) last[mm.conversation_id] = { content: mm.content, role: mm.role }; }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Clientes", href: "/admin/clientes" }, { label: "Consultor" }]} className="mb-4" />
      <PageHeader eyebrow="Clientes · copiloto" title="Conversas do Consultor"
        subtitle="O copiloto do programa conversando com cada cliente — assuma quando quiser."
        comoUsar={<HelpButton routeKey="/admin/consultor" />}
        actions={<ConfigLink cat="ia" label="Modelo & prompts" />} />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Cliente</th><th className="th">Canal</th><th className="th">Última mensagem</th><th className="th">Msgs</th><th className="th">Início</th><th className="th"></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-navy3/50 border-b border-line last:border-0">
                <td className="td text-cream">{orgName[c.org_id] ?? "—"}</td>
                <td className="td"><span className="badge-muted">{CANAL_LABEL[c.canal] ?? c.canal}</span></td>
                <td className="td text-xs text-muted max-w-md truncate">{last[c.id] ? `${last[c.id].role === "user" ? "Cliente: " : ""}${last[c.id].content}` : "—"}</td>
                <td className="td text-xs text-muted2">{msgCount[c.id] ?? 0}</td>
                <td className="td text-xs text-muted2">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="td text-right"><Link href={`/admin/consultor/${c.id}`} className="text-gold text-sm hover:underline">Abrir</Link></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td className="td text-muted2" colSpan={6}>Nenhuma conversa ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
