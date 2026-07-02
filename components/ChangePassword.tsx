"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ChangePassword() {
  const supabase = createClient();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 10) return setMsg({ ok: false, text: "A senha deve ter ao menos 10 caracteres." });
    if (pw !== pw2) return setMsg({ ok: false, text: "As senhas não coincidem." });
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setPw(""); setPw2("");
    setMsg({ ok: true, text: "✓ Senha alterada com sucesso." });
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-sm">
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
      <button className="btn-gold" disabled={loading}>{loading ? "Salvando…" : "Alterar senha"}</button>
    </form>
  );
}
