import { MfaEnroll } from "@/components/MfaEnroll";
import { ChangePassword } from "@/components/ChangePassword";
import { ConfigNav } from "@/components/config/ConfigNav";

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ mfa?: string }> }) {
  const { mfa } = await searchParams;
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">A Fortaleza · Domínio 1</p>
      <h1 className="font-serif text-4xl font-semibold mb-6">Configurações &amp; Segurança</h1>
      <ConfigNav />

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
  );
}
