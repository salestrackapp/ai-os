"use client";
/**
 * Preço do curso e quem tem acesso. Duas coisas numa tela porque são a mesma decisão:
 * "quanto custa" e "quem entrou sem pagar".
 */
import { useState, useTransition } from "react";
import { Button, Card, Field, Input, Select, Badge, EmptyState } from "@/components/ds";
import { salvarPrecoCurso, liberarGratuitamente, cancelarMatricula } from "@/app/admin/academy/matriculas/actions";

export type MatriculaLinha = {
  id: string; nome: string | null; email: string | null; status: string;
  origem: string; criadaEm: string; pagou: boolean; valorCentavos: number;
};

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TOM: Record<string, "success" | "warn" | "neutral" | "danger"> = {
  ativa: "success", concluida: "success", pendente: "warn", cancelada: "danger", expirada: "neutral",
};

export function GestaoMatriculas({ courseId, cursoTitulo, gratuito, precoCentavos, checkoutUrl, matriculas }: {
  courseId: string; cursoTitulo: string; gratuito: boolean; precoCentavos: number;
  checkoutUrl: string | null; matriculas: MatriculaLinha[];
}) {
  const [g, setG] = useState(gratuito);
  const [preco, setPreco] = useState(String(precoCentavos / 100));
  const [url, setUrl] = useState(checkoutUrl ?? "");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function guardarPreco() {
    setErro(null); setMsg(null);
    iniciar(async () => {
      try {
        await salvarPrecoCurso(courseId, {
          gratuito: g, precoCentavos: Math.round(Number(preco.replace(",", ".")) * 100) || 0, checkoutUrl: url,
        });
        setMsg("Salvo.");
      } catch (e) { setErro((e as Error).message); }
    });
  }

  function liberar() {
    setErro(null); setMsg(null);
    iniciar(async () => {
      try {
        await liberarGratuitamente(courseId, email, nome);
        setMsg(`Acesso liberado para ${email}.`); setEmail(""); setNome("");
      } catch (e) { setErro((e as Error).message); }
    });
  }

  return (
    <div className="space-y-6">
      <Card title={`Como "${cursoTitulo}" é vendido`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Modo">
            {(f) => (
              <Select {...f} value={g ? "gratuito" : "pago"} onChange={(e) => setG(e.target.value === "gratuito")}>
                <option value="gratuito">Gratuito — qualquer pessoa se matricula direto</option>
                <option value="pago">Pago — só entra depois de pagar</option>
              </Select>
            )}
          </Field>
          {!g && (
            <Field label="Preço" hint="Em reais. Ex.: 497">
              {(f) => <Input {...f} inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />}
            </Field>
          )}
        </div>
        {!g && (
          <div className="mt-4">
            <Field label="Link de pagamento" hint="Cole aqui o link de cobrança do ASAAS ou Stripe. É para onde o aluno vai ao clicar em comprar.">
              {(f) => <Input {...f} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />}
            </Field>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
          <Button variant="primary" onClick={guardarPreco} loading={pendente}>Salvar</Button>
          {msg && <span className="text-sm font-medium text-[color:var(--success)]">{msg}</span>}
          {erro && <span className="text-sm text-[color:var(--danger)]">{erro}</span>}
        </div>
      </Card>

      <Card title="Liberar acesso sem cobrar">
        <p className="ds-body mb-4">
          Dá acesso imediato a alguém que já tem conta no sistema — cortesia, parceria ou aluno que pagou por fora.
          Fica registrado como pedido de valor zero, então aparece nos mesmos relatórios da venda.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail da pessoa">{(f) => <Input {...f} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com.br" />}</Field>
          <Field label="Nome para o certificado">{(f) => <Input {...f} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Maria Silva" />}</Field>
        </div>
        <div className="mt-5 border-t border-hairline pt-4">
          <Button variant="primary" onClick={liberar} loading={pendente} disabled={!email.trim()}>Liberar acesso</Button>
        </div>
      </Card>

      <div>
        <h2 className="ds-h3 mb-3">Quem tem acesso <Badge tone="neutral">{matriculas.length}</Badge></h2>
        {matriculas.length === 0 ? (
          <EmptyState title="Ninguém matriculado ainda"
            description="Assim que alguém comprar ou você liberar acesso, a pessoa aparece aqui." />
        ) : (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr>
                  {["Pessoa", "Situação", "Como entrou", "Valor", ""].map((h) => <th key={h} className="th">{h}</th>)}
                </tr></thead>
                <tbody>
                  {matriculas.map((m) => (
                    <tr key={m.id}>
                      <td className="td">
                        <span className="block font-medium text-[color:var(--fg-1)]">{m.nome ?? "—"}</span>
                        <span className="block text-xs text-[color:var(--fg-3)]">{m.email ?? "—"}</span>
                      </td>
                      <td className="td"><Badge tone={TOM[m.status] ?? "neutral"}>{m.status}</Badge></td>
                      <td className="td text-[color:var(--fg-2)]">
                        {m.origem === "salestrack" ? "Liberado pela Salestrack" : m.origem === "org" ? "Vaga da empresa" : "Individual"}
                      </td>
                      <td className="td font-jbmono text-[color:var(--fg-2)]">
                        {m.pagou ? (m.valorCentavos > 0 ? reais(m.valorCentavos) : "cortesia") : "—"}
                      </td>
                      <td className="td text-right">
                        {m.status !== "cancelada" && (
                          <Button variant="ghost" size="sm"
                            onClick={() => { if (confirm(`Revogar o acesso de ${m.email ?? m.nome}?`)) iniciar(async () => { await cancelarMatricula(m.id); }); }}>
                            Revogar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
