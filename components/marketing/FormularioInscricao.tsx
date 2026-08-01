"use client";
import { useState, useTransition } from "react";
import { inscreverAction } from "@/app/inscrever/actions";

const campo = "w-full rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 py-2.5 font-montserrat text-[15px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand)]";
const rotulo = "mb-1 block font-montserrat text-[13px] font-medium text-[color:var(--fg-2)]";

export function FormularioInscricao() {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  /** Nasce DESMARCADA. Caixa pré-marcada não é consentimento livre — é consentimento presumido. */
  const [aceite, setAceite] = useState(false);
  const [resposta, setResposta] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    iniciar(async () => setResposta(await inscreverAction({ email, nome, empresa, aceite })));
  };

  /**
   * Depois do envio bem-sucedido o formulário some.
   *
   * Deixá-lo na tela convidaria a reenviar, e o segundo envio parece não ter funcionado — o e-mail
   * de confirmação é o mesmo, e a caixa de entrada demora. O que a pessoa precisa agora é saber
   * que o próximo passo está no e-mail dela, não um botão para apertar de novo.
   */
  if (resposta?.ok) {
    return (
      <div>
        <p className="mb-2 font-montserrat text-[17px] font-bold text-[color:var(--fg-1)]">Falta um clique</p>
        <p className="font-montserrat text-[14.5px] leading-relaxed text-[color:var(--fg-2)]">{resposta.mensagem}</p>
        <p className="mt-3 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-3)]">
          Não chegou em alguns minutos? Olhe no spam — e, se estiver lá, marque como "não é spam":
          é o que faz os próximos chegarem na caixa certa.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label className={rotulo} htmlFor="email">E-mail</label>
        <input id="email" className={campo} type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={rotulo} htmlFor="nome">Nome <span className="font-normal text-[color:var(--fg-4)]">(opcional)</span></label>
          <input id="nome" className={campo} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className={rotulo} htmlFor="empresa">Empresa <span className="font-normal text-[color:var(--fg-4)]">(opcional)</span></label>
          <input id="empresa" className={campo} value={empresa} onChange={(e) => setEmpresa(e.target.value)} autoComplete="organization" />
        </div>
      </div>

      <label className="flex items-start gap-2.5 rounded-ds-card border border-hairline bg-[var(--bg-2)] p-3">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]" />
        <span className="font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-2)]">
          Quero receber e-mails da Salestrack AI sobre IA aplicada a vendas. Sei que posso sair a
          qualquer momento pelo link no rodapé de cada mensagem.
        </span>
      </label>

      {resposta && !resposta.ok && (
        <p className="rounded-ds-input bg-[#FDECEC] px-3 py-2 font-montserrat text-[13.5px] text-[#B42318]">{resposta.mensagem}</p>
      )}

      <button type="submit" disabled={pendente}
        className="ds-focus h-11 w-full rounded-ds-input bg-brand font-montserrat text-[15px] font-semibold text-white shadow-ds-brand hover:bg-brand-hover disabled:opacity-50">
        {pendente ? "Enviando…" : "Quero receber"}
      </button>
    </form>
  );
}
