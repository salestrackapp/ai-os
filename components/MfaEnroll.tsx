"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function MfaEnroll() {
  const supabase = createClient();
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function enroll() {
    setMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) return setMsg(error.message);
    setQr(data.totp.qr_code);
    setFactorId(data.id);
  }

  async function verify() {
    if (!factorId) return;
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) return setMsg(challenge.error.message);
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
    setMsg(error ? error.message : "✓ MFA ativado com sucesso.");
    if (!error) { setQr(null); setFactorId(null); }
  }

  return (
    <div className="space-y-4">
      {!qr && <button onClick={enroll} className="btn-gold">Ativar MFA (TOTP)</button>}
      {qr && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 w-fit" dangerouslySetInnerHTML={{ __html: qr.startsWith("<svg") ? qr : `<img src="${qr}" alt="QR MFA" />` }} />
          <div className="flex gap-3 max-w-xs">
            <input className="input font-mono" placeholder="Código de 6 dígitos" value={code} onChange={(e) => setCode(e.target.value)} />
            <button onClick={verify} className="btn-gold shrink-0">Verificar</button>
          </div>
        </div>
      )}
      {msg && <p className="text-sm text-teal">{msg}</p>}
    </div>
  );
}
