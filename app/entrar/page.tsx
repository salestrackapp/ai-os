import { redirect } from "next/navigation";
import { currentMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Resolvedor pós-login: roteia por papel. */
export default async function Entrar() {
  const m = await currentMembership();
  if (!m) redirect("/login");
  if (m.isSalestrackAdmin) redirect("/admin");
  if (m.orgId) redirect("/portal");
  redirect("/sem-acesso");
}
