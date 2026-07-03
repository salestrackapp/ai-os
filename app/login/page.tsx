"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMsg(error.message);
    window.location.assign(params.get("next") ?? "/entrar");
  }

  async function magicLink() {
    if (!email) return setMsg("Informe o e-mail para receber o link mágico.");
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: `${location.origin}/entrar` },
    });
    setLoading(false);
    setMsg(error ? error.message : "Link mágico enviado — verifique seu e-mail.");
  }

  async function forgotPassword() {
    if (!email) return setMsg("Informe o e-mail para recuperar a senha.");
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset`,
    });
    setLoading(false);
    setMsg(error ? error.message : "Se o e-mail existir, enviamos um link para redefinir a senha.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-md p-9">
        <p className="text-[11px] uppercase tracking-[.28em] text-gold mb-3">AI Operation System</p>
        <h1 className="font-serif text-4xl font-semibold mb-1">Entrar</h1>
        <p className="text-sm text-muted mb-8">Ambiente seguro · Salestrack AI</p>
        <form onSubmit={signIn} className="space-y-4">
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" required />
          </div>
          <div>
            <label className="label">Senha</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {msg && <p className="text-sm text-teal">{msg}</p>}
          <button className="btn-gold w-full justify-center" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
          <button type="button" onClick={magicLink} className="btn-ghost w-full justify-center" disabled={loading}>
            Receber link mágico por e-mail
          </button>
          <button type="button" onClick={forgotPassword} className="w-full text-center text-xs text-muted2 hover:text-gold transition-colors" disabled={loading}>
            Esqueci minha senha
          </button>
        </form>
        <p className="mt-8 text-[11px] text-muted2 text-center">MFA obrigatório para administradores Salestrack — configure em Configurações após o primeiro acesso.</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
