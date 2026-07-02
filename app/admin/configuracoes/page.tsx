import { MfaEnroll } from "@/components/MfaEnroll";

export default function ConfigPage() {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">A Fortaleza · Domínio 1</p>
      <h1 className="font-serif text-4xl font-semibold mb-8">Configurações &amp; Segurança</h1>
      <div className="card p-8">
        <h2 className="font-serif text-2xl font-semibold mb-2">Autenticação em dois fatores (MFA)</h2>
        <p className="text-sm text-muted mb-6">Obrigatória para administradores Salestrack. Use um app autenticador (Google Authenticator, 1Password, Authy).</p>
        <MfaEnroll />
      </div>
      <div className="card p-8 mt-5">
        <h2 className="font-serif text-2xl font-semibold mb-2">White-label</h2>
        <p className="text-sm text-muted">Personalização por tenant (Níveis 2 e 3) entra na Fase 6 — as tabelas <span className="font-mono text-xs text-teal">tenant_branding</span> e <span className="font-mono text-xs text-teal">custom_domains</span> já estão prontas no banco.</p>
      </div>
    </div>
  );
}
