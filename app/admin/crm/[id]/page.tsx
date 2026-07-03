import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmNav } from "@/components/crm/CrmNav";
import { DealDetail } from "@/components/crm/DealDetail";
import type { Deal, SignalDefinition, Contact, Organization, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("*").eq("id", id).single();
  if (!deal) notFound();

  const [{ data: signalDefs }, { data: activities }, { data: contacts }, { data: orgs }, { data: tasks }, { data: proposals }] = await Promise.all([
    supabase.from("signal_definitions").select("*").eq("active", true).order("sort"),
    supabase.from("activities").select("id, kind, payload, created_at").eq("ref_table", "deals").eq("ref_id", id).order("created_at", { ascending: false }),
    supabase.from("contacts").select("*").order("name"),
    supabase.from("organizations").select("*").eq("is_salestrack", false).order("name"),
    supabase.from("tasks").select("*").eq("deal_id", id).order("done").order("due_date", { nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("proposals").select("id, title, version, status").eq("deal_id", id).order("version", { ascending: false }),
  ]);

  const d = deal as Deal;
  // Contatos da conta (mesma org); se o deal não tem org, mostra leads sem org.
  const scoped = (contacts as Contact[] ?? []).filter((c) => d.org_id ? c.org_id === d.org_id : c.org_id === null);
  // garante que o contato principal apareça mesmo se estiver fora do escopo
  const primary = (contacts as Contact[] ?? []).find((c) => c.id === d.contact_id);
  const list = primary && !scoped.some((c) => c.id === primary.id) ? [primary, ...scoped] : scoped;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/crm" className="text-muted2 hover:text-gold text-sm">← CRM</Link>
      </div>
      <CrmNav />
      <DealDetail
        deal={d}
        signalDefs={(signalDefs as SignalDefinition[]) ?? []}
        activities={(activities as { id: string; kind: string; payload: Record<string, unknown> | null; created_at: string }[]) ?? []}
        contacts={list}
        orgs={(orgs as Organization[]) ?? []}
        tasks={(tasks as Task[]) ?? []}
        proposals={(proposals as { id: string; title: string; version: number; status: string }[]) ?? []}
      />
    </div>
  );
}
