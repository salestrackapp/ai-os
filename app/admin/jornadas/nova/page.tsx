/** Nova Jornada (U2) — cadastro em 1 tela: cria cliente + oportunidade + diagnóstico e devolve o link. */
import Link from "next/link";
import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createClient } from "@/lib/supabase/server";
import { NovaJornadaForm } from "@/components/journey/NovaJornadaForm";

export const dynamic = "force-dynamic";

const OFERTAS_PADRAO = [
  "Fase 1 — Presença Digital + Agente IA 24h",
  "Diagnóstico Digital (avulso)",
  "Sprint de Aceleração",
  "Manutenção mensal",
];

export default async function NovaJornada() {
  // ofertas do catálogo (se houver), senão as padrão
  const sb = await createClient();
  const { data: itens } = await sb.from("catalog_items").select("name").is("deleted_at", null).limit(20);
  const ofertas = [...new Set([...(itens ?? []).map((i) => i.name as string).filter(Boolean), ...OFERTAS_PADRAO])];

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Jornadas", href: "/admin/jornadas" }, { label: "Nova jornada" }]} className="mb-4" />
      <PageHeader eyebrow="Operação" title="Nova jornada"
        subtitle="Três campos e pronto: o cliente entra e o diagnóstico já sai. Sem contrato ou CNPJ para começar."
        actions={<Link href="/admin/jornadas" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Voltar ao painel</Link>} />
      <div className="mt-2 rounded-ds-card border border-hairline bg-[var(--bg-1)] p-6 shadow-ds-card sm:p-8">
        <NovaJornadaForm ofertas={ofertas} />
      </div>
    </ContentArea>
  );
}
