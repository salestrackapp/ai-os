"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { acceptInvite } from "@/app/portal/equipe/actions";

export function AcceptInvite({ token, email }: { token: string; email: string }) {
  const supabase = createClient();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("A senha deve ter ao menos 8 caracteres.");
    if (pw !== pw2) return setErr("As senhas não coincidem.");
    setLoading(true);
    try {
      await acceptInvite(token, pw);
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      window.location.assign("/portal");
    } catch (e) { setLoading(false); setErr((e as Error).message); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">E-mail</label><input className="input" value={email} disabled /></div>
      <div><label className="label">Crie sua senha</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoFocus /></div>
      <div><label className="label">Confirmar senha</label><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" /></div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button className="btn-gold w-full justify-center" disabled={loading}>{loading ? "Entrando…" : "Criar conta e entrar"}</button>
    </form>
  );
}
