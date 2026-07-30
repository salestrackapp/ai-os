import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { GestaoMatriculas, type MatriculaLinha } from "@/components/admin/GestaoMatriculas";

export const dynamic = "force-dynamic";

export default async function MatriculasAdminPage({ searchParams }: { searchParams: Promise<{ curso?: string }> }) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Academy" title="Matrículas" subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const { curso } = await searchParams;
  const svc = createServiceClient();
  const { data: cursos } = await svc.from("academy_courses")
    .select("id, titulo, gratuito, preco_centavos, checkout_url").is("deleted_at", null).order("titulo");

  const atual = (cursos ?? []).find((c) => c.id === curso) ?? cursos?.[0];
  if (!atual) {
    return <ContentArea><PageHeader eyebrow="Academy" title="Matrículas" subtitle="Nenhum curso cadastrado ainda." /></ContentArea>;
  }

  const { data: mats } = await svc.from("academy_enrollments")
    .select("id, nome, email, status, origem, created_at, user_id").eq("course_id", atual.id).order("created_at", { ascending: false });

  const { data: pedidos } = await svc.from("academy_orders")
    .select("user_id, status, valor_centavos").eq("course_id", atual.id).eq("status", "pago");
  const pagos = new Map((pedidos ?? []).map((p) => [p.user_id, p.valor_centavos]));

  const linhas: MatriculaLinha[] = (mats ?? []).map((x) => ({
    id: x.id, nome: x.nome, email: x.email, status: x.status, origem: x.origem,
    criadaEm: x.created_at, pagou: pagos.has(x.user_id), valorCentavos: pagos.get(x.user_id) ?? 0,
  }));

  return (
    <ContentArea>
      <Breadcrumbs
        items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Estúdio", href: "/admin/estudio-area" }, { label: "Matrículas da Academy" }]}
        className="mb-4"
      />
      <PageHeader
        eyebrow="Academy"
        title="Matrículas e preço"
        subtitle="Define se o curso é gratuito ou pago e mostra quem tem acesso. Você também libera alguém sem cobrar — fica registrado como cortesia."
      />
      <GestaoMatriculas
        courseId={atual.id} cursoTitulo={atual.titulo}
        gratuito={atual.gratuito} precoCentavos={atual.preco_centavos}
        checkoutUrl={atual.checkout_url} matriculas={linhas}
      />
    </ContentArea>
  );
}
