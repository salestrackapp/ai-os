"use client";
import { useTransition } from "react";
import { MEMBERSHIP_ROLES } from "@/lib/types";
import { changeRole, removeMember } from "@/app/admin/configuracoes/equipe/actions";

type Member = { userId: string; email: string | null; role: string; mfa: boolean; created_at: string; self: boolean };

export function TeamManager({ members }: { members: Member[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead><tr>
          <th className="th">Membro</th><th className="th">Papel</th><th className="th">MFA</th><th className="th">Desde</th><th className="th"></th>
        </tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="hover:bg-navy3/50">
              <td className="td text-cream">{m.email ?? m.userId}{m.self && <span className="text-xs text-gold"> · você</span>}</td>
              <td className="td">
                <select className="input !py-1 w-44" defaultValue={m.role} disabled={pending}
                  onChange={(e) => start(() => changeRole(m.userId, e.target.value).then(() => {}))}>
                  {Object.entries(MEMBERSHIP_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
              <td className="td">{m.mfa ? <span className="badge-teal">ativo</span> : <span className="badge-muted">—</span>}</td>
              <td className="td text-xs text-muted2">{new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
              <td className="td text-right">
                {!m.self && (
                  <button className="text-muted2 hover:text-red-400 text-xs" disabled={pending}
                    onClick={() => { if (confirm(`Remover ${m.email}?`)) start(() => removeMember(m.userId).then(() => {})); }}>
                    Remover
                  </button>
                )}
              </td>
            </tr>
          ))}
          {members.length === 0 && <tr><td className="td text-muted2" colSpan={5}>Nenhum membro.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
