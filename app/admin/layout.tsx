import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { tourSeen } from "@/lib/tour/state";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) redirect(m?.orgId ? "/portal" : "/sem-acesso");

  const seen = await tourSeen("admin");
  return <AdminChrome email={user.email ?? ""} tourSeen={seen}>{children}</AdminChrome>;
}
