"use client";
/**
 * O registro de operações de tratamento, do lado de quem responde por ele.
 *
 * ── O aviso que a tela precisa dar ───────────────────────────────────────────────────────────
 * Esta é a única tela do sistema onde editar um campo muda IMEDIATAMENTE um texto público. Quem
 * mexe aqui precisa saber disso antes de salvar, não depois — daí o aviso ficar em cima, e não
 * numa nota de rodapé que ninguém lê.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Badge, Field, Input, Textarea } from "@/components/ds";
import { semearAction, editarOperacaoAction, alternarOperadorAction } from "@/app/admin/lgpd/registro/actions";
import { BASE_LEGAL_TEXTO } from "@/lib/lgpd/registro-conteudo";

export type OperacaoLinha = {
  chave: string; nome: string; finalidade: string; baseLegal: string;
  titulares: string; dados: string; origem: string;
  compartilhamento: string | null; retencao: string;
  ondeNoSistema: string | null; observacao: string | null;
};
export type OperadorLinha = {
  chave: string; nome: string; papel: string; dados: string; pais: string; site: string | null; ativo: boolean;
};

const CAMPOS: { campo: string; rotulo: string; ajuda: string; longo?: boolean }[] = [
  { campo: "nome", rotulo: "Nome da operação", ajuda: "Como ela aparece na política pública." },
  { campo: "finalidade", rotulo: "Para que serve", ajuda: "A finalidade específica. Vago aqui derruba a base legal lá.", longo: true },
  { campo: "titulares", rotulo: "De quem são os dados", ajuda: "Que grupo de pessoas." },
  { campo: "dados", rotulo: "Que dados", ajuda: "As categorias, não a lista de colunas.", longo: true },
  { campo: "origem", rotulo: "De onde vem", ajuda: "A pessoa entregou, ou fomos buscar?" },
  { campo: "compartilhamento", rotulo: "Quem mais vê", ajuda: "Operadores e terceiros.", longo: true },
  { campo: "retencao", rotulo: "Por quanto tempo", ajuda: "E o que encerra o prazo.", longo: true },
  { campo: "observacao", rotulo: "Observação", ajuda: "O que a pessoa mais estranharia se descobrisse depois.", longo: true },
  { campo: "onde_no_sistema", rotulo: "Onde no sistema", ajuda: "Tabelas e módulos. NÃO vai para a página pública — serve para conferir a linha contra o código." },
];

export function RegistroTratamento({ operacoes, operadores }: { operacoes: OperacaoLinha[]; operadores: OperadorLinha[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);

  const rodar = (fn: () => Promise<unknown>, ok?: string) =>
    iniciar(async () => {
      setErro(null); setAviso(null);
      try { const r = await fn(); setAviso(ok ?? (typeof r === "string" ? r : "Pronto.")); router.refresh(); }
      catch (e) { setErro((e as Error).message); }
    });

  const foraDoBrasil = [...new Set(operadores.filter((o) => o.ativo && !/^Brasil/.test(o.pais)).map((o) => o.pais))];

  return (
    <>
      <Card className="mb-6 border-[color:var(--brand)]">
        <p className="font-montserrat text-[14px] leading-relaxed text-[color:var(--fg-1)]">
          <b>O que você editar aqui aparece na hora na página pública de privacidade.</b> Não há uma
          segunda versão do texto — é de propósito: registro interno e política pública que divergem
          é exatamente o que vira infração, e divergir por esquecimento é o jeito mais fácil de
          chegar lá.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={pendente}
            onClick={() => rodar(() => semearAction())}>
            Recarregar a semente do código
          </Button>
          <a href="/privacidade" target="_blank" rel="noreferrer"
            className="font-montserrat text-[13.5px] font-medium text-[color:var(--brand)] hover:underline">
            Ver a página pública ↗
          </a>
        </div>
        {aviso && <p className="mt-3 rounded-ds-input bg-[#ECFDF3] px-3 py-2 font-montserrat text-[13px] text-[#027A48]">{aviso}</p>}
        {erro && <p className="mt-3 rounded-ds-input bg-[#FDECEC] px-3 py-2 font-montserrat text-[13px] text-[#B42318]">{erro}</p>}
      </Card>

      <p className="ds-eyebrow mb-2">Operações · {operacoes.length}</p>
      <div className="mb-8 space-y-3">
        {operacoes.map((o) => (
          <Card key={o.chave}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">{o.nome}</p>
                <p className="ds-small !mt-0.5">
                  Base legal: {BASE_LEGAL_TEXTO[o.baseLegal as keyof typeof BASE_LEGAL_TEXTO] ?? o.baseLegal}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setEditando(editando === o.chave ? null : o.chave)}>
                {editando === o.chave ? "Fechar" : "Editar"}
              </Button>
            </div>

            {editando === o.chave
              ? <FormularioOperacao op={o} pendente={pendente}
                  onSalvar={(campos) => rodar(() => editarOperacaoAction(o.chave, campos), "Registro atualizado — a página pública já mudou.")} />
              : (
                <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <Linha rotulo="Para que serve" valor={o.finalidade} />
                  <Linha rotulo="De quem" valor={o.titulares} />
                  <Linha rotulo="Que dados" valor={o.dados} />
                  <Linha rotulo="De onde vem" valor={o.origem} />
                  <Linha rotulo="Quem mais vê" valor={o.compartilhamento} />
                  <Linha rotulo="Por quanto tempo" valor={o.retencao} />
                  {o.observacao && <Linha rotulo="Observação" valor={o.observacao} />}
                  {o.ondeNoSistema && <Linha rotulo="Onde no sistema (interno)" valor={o.ondeNoSistema} />}
                </dl>
              )}
          </Card>
        ))}
      </div>

      <p className="ds-eyebrow mb-2">Operadores · quem recebe dado por nossa conta</p>
      {foraDoBrasil.length > 0 && (
        <p className="ds-small mb-3">
          Transferência internacional em curso para: <b>{foraDoBrasil.join(", ")}</b>. A página
          pública informa isso, como os arts. 33 a 36 exigem.
        </p>
      )}
      <Card>
        <ul className="divide-y divide-[color:var(--border)]">
          {operadores.map((o) => (
            <li key={o.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-montserrat text-[13.5px] font-medium text-[color:var(--fg-1)]">
                  {o.nome} <span className="font-normal text-[color:var(--fg-3)]">· {o.pais}</span>
                </span>
                <span className="block font-montserrat text-[12.5px] text-[color:var(--fg-3)]">{o.papel}</span>
              </span>
              <Badge tone={o.ativo ? "success" : "neutral"}>{o.ativo ? "em uso" : "desligado"}</Badge>
              <Button variant="ghost" disabled={pendente}
                onClick={() => rodar(() => alternarOperadorAction(o.chave, !o.ativo),
                  o.ativo ? `${o.nome} saiu da política pública.` : `${o.nome} entrou na política pública.`)}>
                {o.ativo ? "Desligar" : "Ligar"}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="font-montserrat text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fg-4)]">{rotulo}</dt>
      <dd className="font-montserrat text-[13.5px] leading-relaxed text-[color:var(--fg-2)]">{valor}</dd>
    </div>
  );
}

function FormularioOperacao({ op, pendente, onSalvar }: {
  op: OperacaoLinha; pendente: boolean; onSalvar: (campos: Record<string, string>) => void;
}) {
  const inicial: Record<string, string> = {
    nome: op.nome, finalidade: op.finalidade, titulares: op.titulares, dados: op.dados,
    origem: op.origem, compartilhamento: op.compartilhamento ?? "", retencao: op.retencao,
    observacao: op.observacao ?? "", onde_no_sistema: op.ondeNoSistema ?? "",
  };
  const [f, setF] = useState(inicial);

  return (
    <div className="mt-4 space-y-4">
      {CAMPOS.map((c) => (
        <Field key={c.campo} label={c.rotulo} hint={c.ajuda}>
          {(p) => c.longo
            ? <Textarea {...p} rows={3} value={f[c.campo]} onChange={(e) => setF((a) => ({ ...a, [c.campo]: e.target.value }))} />
            : <Input {...p} value={f[c.campo]} onChange={(e) => setF((a) => ({ ...a, [c.campo]: e.target.value }))} />}
        </Field>
      ))}
      <Button disabled={pendente} onClick={() => onSalvar(f)}>
        {pendente ? "Salvando…" : "Salvar no registro e na política"}
      </Button>
    </div>
  );
}
