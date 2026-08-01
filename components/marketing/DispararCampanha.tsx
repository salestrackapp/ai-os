"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dispararAction } from "@/app/admin/marketing/email/actions";

/**
 * O botão que não dá para apertar sem olhar.
 *
 * A confirmação é o NÚMERO de destinatários digitado à mão, não um "tem certeza?". Diálogo de
 * certeza é clicado no reflexo — quem já está com a mão no mouse confirma antes de ler. Digitar o
 * número obriga a olhar para ele, e é exatamente aí que se percebe que a lista tem 4 mil pessoas
 * quando você esperava 40.
 */
export function DispararCampanha({ id, total, amostra }: { id: string; total: number; amostra: string[] }) {
  const [confirmacao, setConfirmacao] = useState("");
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const disparar = () => iniciar(async () => {
    const r = await dispararAction(id, confirmacao);
    if (!r.ok) { setMsg({ tom: "erro", texto: r.erro ?? "Não deu para disparar." }); return; }
    setMsg({ tom: "ok", texto: `Enviada para ${r.enviados} pessoa(s)${r.falhas ? `, com ${r.falhas} falha(s)` : ""}.` });
    router.refresh();
  });

  return (
    <div className="mb-5 rounded-ds-card border border-[color:var(--brand-light)] bg-[var(--tile)] p-5">
      <p className="mb-1 font-montserrat text-[15px] font-semibold text-[color:var(--brand-deep)]">Aprovada — pronta para sair</p>
      <p className="ds-small !mt-0 mb-3">
        Vai para <b>{total}</b> pessoa(s){amostra.length > 0 && <>, começando por {amostra.join(", ")}{total > amostra.length && " e outros"}</>}.
        A lista é recalculada no momento do disparo: quem pedir para sair até lá não recebe.
      </p>

      {msg && (
        <p className={`mb-3 rounded-ds-input px-3 py-2 font-montserrat text-[13px] ${msg.tom === "ok" ? "bg-[var(--bg-1)] text-[color:var(--brand-deep)]" : "bg-[#FDECEC] text-[#B42318]"}`}>{msg.texto}</p>
      )}

      <label className="mb-1 block font-montserrat text-[12.5px] text-[color:var(--fg-2)]">
        Para confirmar, digite <b>{total}</b> — o número de pessoas que vão receber:
      </label>
      <div className="flex flex-wrap gap-2">
        <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} inputMode="numeric"
          className="w-32 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 py-2 font-jbmono text-[14px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand)]" />
        <button type="button" disabled={pendente || confirmacao.trim() !== String(total)} onClick={disparar}
          className="ds-focus h-10 rounded-ds-input bg-brand px-5 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-40">
          {pendente ? "Enviando…" : "Disparar agora"}
        </button>
      </div>
    </div>
  );
}
