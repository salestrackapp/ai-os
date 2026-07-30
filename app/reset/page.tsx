"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPage() {
  const supabase = createClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) { setHasSession(true); setReady(true); }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 10) return setMsg({ ok: false, text: "A senha deve ter ao menos 10 caracteres." });
    if (pw !== pw2) return setMsg({ ok: false, text: "As senhas não coincidem." });
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "✓ Senha redefinida. Redirecionando…" });
    setTimeout(() => { router.push("/admin"); router.refresh(); }, 1200);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-md p-9">
        <p className="text-[13px] uppercase tracking-[.28em] text-gold mb-3">AI Operation System</p>
        <h1 className="font-serif text-4xl font-semibold mb-1">Redefinir senha</h1>
        <p className="text-sm text-muted mb-8">Escolha uma nova senha para sua conta.</p>

        {!ready && <p className="text-sm text-muted">Validando o link…</p>}

        {ready && !hasSession && (
          <div className="space-y-4">
            <p className="text-sm text-red-400">Link inválido ou expirado. Solicite um novo em “Esqueci minha senha”.</p>
            <a href="/login" className="btn-ghost">Voltar ao login</a>
          </div>
        )}

        {ready && hasSession && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Nova senha</label>
              <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••••" autoComplete="new-password" required />
            </div>
            <div>
              <label className="label">Confirmar nova senha</label>
              <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
                placeholder="••••••••••" autoComplete="new-password" required />
            </div>
            {msg && <p className={`text-sm ${msg.ok ? "text-teal" : "text-red-400"}`}>{msg.text}</p>}
            <button className="btn-gold w-full justify-center" disabled={loading}>
              {loading ? "Salvando…" : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
