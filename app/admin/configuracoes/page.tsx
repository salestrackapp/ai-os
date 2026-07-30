import Link from "next/link";
import { MfaEnroll } from "@/components/MfaEnroll";
import { ChangePassword } from "@/components/ChangePassword";
import { ConfigNav } from "@/components/config/ConfigNav";
import { PageHeader, ContentArea } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ mfa?: string }> }) {
  const { mfa } = await searchParams;
  return (
    <ContentArea>
      <div className="max-w-2xl">
        <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Plataforma", href: "/admin/plataforma" }, { label: "Configurações" }]} className="mb-4" />
        <PageHeader eyebrow="Plataforma" title="Configurações e segurança"
          subtitle="Parâmetros, integrações e segurança da sua conta."
          comoUsar={<HelpButton routeKey="/admin/plataforma" />} />
        <ConfigNav />

        <Link href="/admin/configuracoes/parametros" className="card p-5 mb-5 flex items-center justify-between gap-3 hover:border-gold/50 transition-colors">
          <div>
            <h2 className="font-serif text-xl font-semibold">Console de Configurações</h2>
            <p className="text-sm text-muted">Todos os parâmetros da plataforma (IA, FinOps, prospecção, planos, marca) e chaves de integração em um só lugar. Precedência app → env → default.</p>
          </div>
          <span className="btn-gold text-xs whitespace-nowrap">Abrir console</span>
        </Link>

        {mfa === "required" && (
          <div className="card p-5 mb-5 border-amber-500/50 bg-amber-500/5">
            <p className="text-sm text-amber-400">MFA é obrigatório para administradores Salestrack. Cadastre um fator abaixo para liberar o acesso ao restante do painel.</p>
          </div>
        )}

        <div className="card p-8">
          <h2 className="font-serif text-2xl font-semibold mb-2">Senha de acesso</h2>
          <p className="text-sm text-muted mb-6">Defina uma nova senha para sua conta. Mínimo de 10 caracteres.</p>
          <ChangePassword />
        </div>
        <div className="card p-8 mt-5">
          <h2 className="font-serif text-2xl font-semibold mb-2">Autenticação em dois fatores (MFA)</h2>
          <p className="text-sm text-muted mb-6">Obrigatória para administradores Salestrack. Use um app autenticador (Google Authenticator, 1Password, Authy).</p>
          <MfaEnroll />
        </div>
      </div>
    </ContentArea>
  );
}
