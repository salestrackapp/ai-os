import { redirect } from "next/navigation";
import { currentMembership } from "@/lib/auth";
import { temMatriculaAtiva } from "@/lib/academy/learner";

export const dynamic = "force-dynamic";

/** Resolvedor pós-login: roteia por papel. */
export default async function Entrar() {
  const m = await currentMembership();
  if (!m) redirect("/login");
  if (m.isSalestrackAdmin) redirect("/admin");
  if (m.orgId) redirect("/portal");
  // Aluno avulso: sem empresa, porém com matrícula. Sem esta checagem ele caía em /sem-acesso.
  if (await temMatriculaAtiva(m.userId)) redirect("/academy");
  redirect("/sem-acesso");
}
