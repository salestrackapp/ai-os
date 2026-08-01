"use client";
import { useState, useTransition } from "react";
import { abrirPedidoAction } from "@/app/privacidade/direitos/actions";
// A mesma lista que o servidor valida e que o e-mail de confirmação repete — ver `tipos-pedido.ts`.
import { TIPOS_PEDIDO, ORDEM_TIPOS } from "@/lib/lgpd/tipos-pedido";

const campo = "w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 py-2.5 font-montserrat text-[15px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand)]";
const rotulo = "mb-1 block font-montserrat text-[13px] font-medium text-[color:var(--fg-2)]";

const OPCOES = ORDEM_TIPOS.map((valor) => ({ valor, ...TIPOS_PEDIDO[valor] }));

export function FormularioDireitos() {
  const [tipo, setTipo] = useState("");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [resposta, setResposta] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    iniciar(async () => setResposta(await abrirPedidoAction({ tipo, email, nome, detalhe })));
  };

  if (resposta?.ok) {
    return (
      <div>
        <p className="mb-2 font-montserrat text-[17px] font-bold text-[color:var(--fg-1)]">Falta um clique</p>
        <p className="font-montserrat text-[14.5px] leading-relaxed text-[color:var(--fg-2)]">{resposta.mensagem}</p>
        <p className="mt-3 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-3)]">
          Pedimos essa confirmação para ter certeza de que quem fez o pedido é a dona ou o dono do
          endereço — é o que impede alguém de mexer nos dados de outra pessoa. Não chegou em alguns
          minutos? Olhe no spam.
        </p>
      </div>
    );
  }

  const escolhida = OPCOES.find((o) => o.valor === tipo);

  return (
    <form onSubmit={enviar} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className={rotulo}>O que você quer pedir</legend>
        {OPCOES.map((o) => (
          <label key={o.valor}
            className={`flex cursor-pointer items-start gap-2.5 rounded-ds-card border p-3 ${
              tipo === o.valor ? "border-[color:var(--brand)] bg-[var(--bg-2)]" : "border-hairline bg-[var(--bg-1)]"}`}>
            <input type="radio" name="tipo" value={o.valor} checked={tipo === o.valor}
              onChange={() => setTipo(o.valor)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]" />
            <span className="font-montserrat text-[14px] leading-snug text-[color:var(--fg-1)]">{o.rotulo}</span>
          </label>
        ))}
      </fieldset>

      {escolhida && (
        <p className="rounded-ds-input bg-[var(--bg-2)] px-3 py-2 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-2)]">
          {escolhida.ajuda}
        </p>
      )}

      <div>
        <label className={rotulo} htmlFor="email">Seu e-mail</label>
        <input id="email" className={campo} type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
        <p className="mt-1 font-montserrat text-[12px] text-[color:var(--fg-3)]">
          Use o endereço pelo qual a gente teria seus dados. É para ele que vai o link de confirmação.
        </p>
      </div>

      <div>
        <label className={rotulo} htmlFor="nome">Nome <span className="font-normal text-[color:var(--fg-4)]">(opcional)</span></label>
        <input id="nome" className={campo} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
      </div>

      <div>
        <label className={rotulo} htmlFor="detalhe">Quer detalhar? <span className="font-normal text-[color:var(--fg-4)]">(opcional)</span></label>
        <textarea id="detalhe" className={`${campo} min-h-[90px]`} value={detalhe}
          onChange={(e) => setDetalhe(e.target.value)}
          placeholder="Ex.: meu cargo mudou, ou não quero mais receber convites para eventos." />
      </div>

      {resposta && !resposta.ok && (
        <p className="rounded-ds-input bg-[#FDECEC] px-3 py-2 font-montserrat text-[13.5px] text-[#B42318]">{resposta.mensagem}</p>
      )}

      <button type="submit" disabled={pendente || !tipo}
        className="ds-focus h-11 w-full rounded-ds-input bg-brand font-montserrat text-[15px] font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-50">
        {pendente ? "Enviando…" : "Enviar pedido"}
      </button>
    </form>
  );
}
