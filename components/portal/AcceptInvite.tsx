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
  const [pronto, setPronto] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("A senha deve ter ao menos 8 caracteres.");
    if (pw !== pw2) return setErr("As senhas não coincidem.");
    setLoading(true);
    try {
      const r = await acceptInvite(token, pw);
      /**
       * Quem já tinha conta continua com a senha dele — o convite dá acesso ao programa, não troca
       * credencial. Entrar com a senha recém-digitada falharia, e a mensagem de erro do Supabase
       * ("Invalid login credentials") faria a pessoa achar que o convite não funcionou. Ele
       * funcionou: o que mudou foi o acesso, não a senha.
       */
      if (r.jaTinhaConta) {
        setLoading(false);
        setPronto("Seu acesso ao programa foi liberado. Você já tinha conta neste e-mail, então entre com a sua senha de sempre — ela não foi alterada.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      window.location.assign("/portal");
    } catch (e) { setLoading(false); setErr((e as Error).message); }
  }

  if (pronto) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-cream">{pronto}</p>
        <a href="/entrar" className="btn-gold w-full justify-center inline-flex">Ir para o login</a>
      </div>
    );
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
