import { redirect } from "next/navigation";
import { currentMembership } from "@/lib/auth";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { tourSeen } from "@/lib/tour/state";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Uma única resolução de membership por navegação (o middleware já validou a sessão).
  const m = await currentMembership();
  if (!m) redirect("/login");
  if (!m.isSalestrackAdmin) redirect(m.orgId ? "/portal" : "/sem-acesso");

  const seen = await tourSeen("admin", m.orgId ? { userId: m.userId, orgId: m.orgId } : null);
  return <AdminChrome email={m.email ?? ""} userId={m.userId} tourSeen={seen}>{children}</AdminChrome>;
}
