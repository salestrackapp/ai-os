import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProposalBuilder } from "@/components/proposals/ProposalBuilder";
import type { CatalogItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NovaProposta({ searchParams }: { searchParams: Promise<{ deal?: string }> }) {
  const { deal } = await searchParams;
  const supabase = await createClient();
  const [{ data: catalog }, { data: deals }, { data: orgs }] = await Promise.all([
    supabase.from("catalog_items").select("*").eq("active", true).order("name"),
    supabase.from("deals").select("id, title, org_id").order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name").eq("is_salestrack", false).order("name"),
  ]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6"><Link href="/admin/propostas" className="text-muted2 hover:text-gold text-sm">← Propostas</Link></div>
      <h1 className="font-serif text-4xl font-semibold mb-6">Nova proposta</h1>
      <ProposalBuilder catalog={(catalog as CatalogItem[]) ?? []} deals={(deals as { id: string; title: string; org_id: string | null }[]) ?? []} orgs={(orgs as { id: string; name: string }[]) ?? []} initialDealId={deal} />
    </div>
  );
}
