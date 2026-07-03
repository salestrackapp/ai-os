import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_STATUS_LABELS, type Project } from "@/lib/types";
import { viewPortalAs } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProgramasPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  const list = (projects as Project[]) ?? [];
  const orgIds = [...new Set(list.map((p) => p.org_id).filter(Boolean))] as string[];
  const [{ data: orgs }, { data: access }] = await Promise.all([
    orgIds.length ? supabase.from("organizations").select("id, name").in("id", orgIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    orgIds.length ? supabase.from("portal_access_log").select("org_id, created_at").in("org_id", orgIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as { org_id: string; created_at: string }[] }),
  ]);
  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  const lastAccess: Record<string, string> = {};
  (access ?? []).forEach((a) => { if (a.org_id && !lastAccess[a.org_id]) lastAccess[a.org_id] = a.created_at; });
  const ativos = list.filter((p) => p.status === "ativo").length;

  return (
    <div>
      <div className="mb-6"><p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Entregar · programas</p><h1 className="font-serif text-4xl font-semibold">Programas</h1></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div className="card p-6"><p className="label">Programas ativos</p><p className="font-serif text-3xl font-semibold text-gold mt-1">{ativos}</p></div>
        <div className="card p-6"><p className="label">Total de programas</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{list.length}</p></div>
        <div className="card p-6"><p className="label">Em onboarding</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{list.filter((p) => p.status === "onboarding").length}</p></div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Programa</th><th className="th">Cliente</th><th className="th">Status</th><th className="th">Ativado</th><th className="th">Último acesso</th><th className="th"></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="hover:bg-navy3/50">
                <td className="td text-cream">{p.name}</td>
                <td className="td text-muted">{p.org_id ? (orgName[p.org_id] ?? "—") : "—"}</td>
                <td className="td"><span className={p.status === "ativo" ? "badge-teal" : p.status === "onboarding" ? "badge-gold" : "badge-muted"}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</span></td>
                <td className="td text-xs text-muted2">{p.activated_at ? new Date(p.activated_at).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="td text-xs text-muted2">{p.org_id && lastAccess[p.org_id] ? new Date(lastAccess[p.org_id]).toLocaleString("pt-BR") : "—"}</td>
                <td className="td text-right whitespace-nowrap">
                  {p.org_id && <form action={viewPortalAs.bind(null, p.org_id)} className="inline"><button className="text-muted2 hover:text-gold text-xs mr-3">👁 Portal</button></form>}
                  <Link href={`/admin/programas/${p.id}`} className="text-gold text-sm hover:underline">Abrir</Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td className="td text-muted2" colSpan={6}>Nenhum programa. Eles são criados no kickoff (contrato assinado).</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
