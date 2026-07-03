"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaChallenge() {
  const supabase = createClient();
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [noFactor, setNoFactor] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.find((f) => f.status === "verified") ?? data?.totp?.[0];
      if (totp) setFactorId(totp.id); else setNoFactor(true);
    });
  }, [supabase]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true); setMsg(null);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) { setLoading(false); return setMsg(challenge.error.message); }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
    if (error) { setLoading(false); return setMsg(error.message); }
    // navegação de página inteira: garante que o cookie AAL2 recém-gravado chegue ao servidor/middleware
    window.location.assign("/admin");
  }

  async function signOut() { await supabase.auth.signOut(); router.push("/login"); }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-md p-9">
        <p className="text-[11px] uppercase tracking-[.28em] text-gold mb-3">AI Operation System</p>
        <h1 className="font-serif text-4xl font-semibold mb-1">Verificação MFA</h1>
        <p className="text-sm text-muted mb-8">Digite o código do seu app autenticador para continuar.</p>

        {noFactor ? (
          <div className="space-y-4">
            <p className="text-sm text-amber-400">MFA é obrigatório para administradores, mas você ainda não cadastrou um fator.</p>
            <a href="/admin/configuracoes" className="btn-gold">Cadastrar MFA em Configurações</a>
          </div>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <input className="input font-mono text-center tracking-[.4em]" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="000000" inputMode="numeric" maxLength={6} autoFocus />
            {msg && <p className="text-sm text-red-400">{msg}</p>}
            <button className="btn-gold w-full justify-center" disabled={loading || code.length < 6}>
              {loading ? "Verificando…" : "Verificar e entrar"}
            </button>
          </form>
        )}
        <button onClick={signOut} className="mt-6 w-full text-center text-xs text-muted2 hover:text-gold">Sair</button>
      </div>
    </main>
  );
}
