import { createClient } from "@/lib/supabase/server";
import { emailMap } from "@/lib/supabase/admin";
import { ConfigNav } from "@/components/config/ConfigNav";
import { AuditView } from "@/components/config/AuditView";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase.from("audit_logs")
    .select("id, action, resource, resource_id, ip, payload, actor_id, created_at")
    .order("created_at", { ascending: false }).limit(500);
  const emails = await emailMap((logs ?? []).map((l) => l.actor_id));

  const rows = (logs ?? []).map((l) => ({
    id: l.id, action: l.action, resource: l.resource, resource_id: l.resource_id,
    ip: (l.ip as string | null) ?? null, payload: l.payload, created_at: l.created_at,
    actor: l.actor_id ? (emails[l.actor_id] ?? "sistema") : "sistema",
  }));

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">A Fortaleza · Auditoria imutável</p>
      <h1 className="font-serif text-4xl font-semibold mb-6">Auditoria</h1>
      <ConfigNav />
      <AuditView rows={rows} />
    </div>
  );
}
