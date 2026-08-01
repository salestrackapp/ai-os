"use client";
import { useState, useTransition } from "react";
import { confirmarPedidoAction } from "@/app/privacidade/direitos/confirmar/[token]/actions";
import type { ResultadoConfirmacao } from "@/lib/lgpd/pedido-publico";
import { TIPOS_PEDIDO, ehTipoPedido } from "@/lib/lgpd/tipos-pedido";

export function ConfirmarPedido({ token, tipo, email }: { token: string; tipo: string; email: string }) {
  const [r, setR] = useState<ResultadoConfirmacao | null>(null);
  const [pendente, iniciar] = useTransition();

  if (r?.estado === "confirmado") {
    const prazo = r.prazoEm ? new Date(r.prazoEm).toLocaleDateString("pt-BR") : null;
    return (
      <div>
        <h1 className="mb-3 font-montserrat text-[24px] font-extrabold leading-tight text-[color:var(--fg-1)]">Pedido confirmado</h1>
        <p className="font-montserrat text-[15px] leading-relaxed text-[color:var(--fg-2)]">
          Seu pedido entrou no nosso registro e uma pessoa vai cuidar dele.
          {prazo && <> Você recebe a resposta até <b>{prazo}</b>.</>}
        </p>
        <p className="mt-3 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-3)]">
          Não precisa fazer mais nada. Se quiser acompanhar ou acrescentar alguma coisa, responda
          o e-mail que você recebeu.
        </p>
      </div>
    );
  }

  // Chegar aqui com resposta significa que o token virou inválido entre carregar a página e clicar
  // (expirou, ou outra aba já confirmou). O texto é um só: o caminho de volta é refazer o pedido.
  if (r) {
    return (
      <p className="font-montserrat text-[15px] leading-relaxed text-[color:var(--fg-2)]">
        Não consegui confirmar este pedido agora. Abra a página de direitos e faça o pedido de novo
        — leva menos de um minuto.
      </p>
    );
  }

  return (
    <div>
      <h1 className="mb-3 font-montserrat text-[24px] font-extrabold leading-tight text-[color:var(--fg-1)]">
        Confirme seu pedido
      </h1>
      <p className="mb-2 font-montserrat text-[15px] leading-relaxed text-[color:var(--fg-2)]">
        Você pediu para <b>{ehTipoPedido(tipo) ? TIPOS_PEDIDO[tipo].curto : "exercer um direito sobre seus dados"}</b>, usando o
        endereço <b>{email}</b>.
      </p>
      <p className="mb-6 font-montserrat text-[13.5px] leading-relaxed text-[color:var(--fg-3)]">
        Pedimos este segundo clique de propósito: é ele que prova que quem fez o pedido é você, e
        não outra pessoa usando seu endereço. <b>Se não foi você, feche esta página</b> — nada
        acontece sem o clique.
      </p>

      <button
        onClick={() => iniciar(async () => setR(await confirmarPedidoAction(token)))}
        disabled={pendente}
        className="ds-focus h-11 w-full rounded-ds-input bg-brand font-montserrat text-[15px] font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-50">
        {pendente ? "Confirmando…" : "Sim, confirmo o pedido"}
      </button>
    </div>
  );
}
