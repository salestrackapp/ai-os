import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { LibraryGrid } from "@/components/portal/LibraryGrid";
import type { LibraryAsset } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Biblioteca() {
  const m = await currentMembership();
  const orgId = m!.orgId!;
  const supabase = await createClient();
  // RLS: assets da própria org + repositório-mestre (org_id null)
  const { data: assets } = await supabase.from("library_assets").select("*").or(`org_id.eq.${orgId},org_id.is.null`).order("created_at", { ascending: false });

  const svc = createServiceClient();
  const items = await Promise.all(((assets as LibraryAsset[]) ?? []).map(async (a) => {
    let url = a.url ?? null;
    if (a.storage_path) { const { data } = await svc.storage.from("biblioteca").createSignedUrl(a.storage_path, 3600); url = data?.signedUrl ?? url; }
    const tags = (a.meta as { tags?: string[] } | null)?.tags ?? [];
    return { id: a.id, title: a.title, type: a.type, frente: a.frente, created_at: a.created_at, url, tags };
  }));

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Materiais do programa</p>
      <h1 className="font-serif text-4xl font-semibold mb-6">Biblioteca</h1>
      <LibraryGrid items={items} />
    </div>
  );
}
