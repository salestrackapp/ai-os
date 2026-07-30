import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Contexto do aluno — irmão de resolvePortalOrg(), não substituto.
 *
 * lib/portal.ts continua intocado de propósito: cerca de vinte páginas do portal fazem
 * `m!.orgId!`, e afrouxar aquele tipo colocaria uma falha de asserção em todas elas.
 *
 * A diferença essencial: aqui a organização é OPCIONAL. O acesso ao conteúdo de formação
 * vem da matrícula, não do vínculo com empresa — é isso que permite ao aluno avulso existir.
 */
export type LearnerCtx = {
  userId: string;
  email: string | null;
  isSalestrackAdmin: boolean;
  orgIds: string[];        // vazio para aluno avulso
  managerOrgIds: string[]; // orgs onde é client_admin ou sponsor
  temMatricula: boolean;
};

export async function resolveLearner(): Promise<LearnerCtx | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const [{ data: mems }, { data: mats }] = await Promise.all([
    sb.from("memberships").select("org_id, role, organizations(is_salestrack)").eq("user_id", user.id),
    sb.from("academy_enrollments").select("id").eq("user_id", user.id).eq("status", "ativa").limit(1),
  ]);

  const rows = mems ?? [];
  const isAdmin = rows.some((m) => {
    const o = m.organizations as unknown as { is_salestrack: boolean } | null;
    return m.role === "salestrack_admin" && o?.is_salestrack;
  });

  return {
    userId: user.id,
    email: user.email ?? null,
    isSalestrackAdmin: isAdmin,
    orgIds: rows.map((m) => m.org_id as string).filter(Boolean),
    managerOrgIds: rows.filter((m) => m.role === "client_admin" || m.role === "sponsor").map((m) => m.org_id as string),
    temMatricula: (mats ?? []).length > 0,
  };
}

/** Tem matrícula ativa em algum curso? Usado pelo roteador pós-login. */
export async function temMatriculaAtiva(userId: string): Promise<boolean> {
  const sb = await createClient();
  const { data } = await sb.from("academy_enrollments")
    .select("id").eq("user_id", userId).eq("status", "ativa").limit(1);
  return (data ?? []).length > 0;
}
