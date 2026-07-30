"use client";
/**
 * Gerar a minuta a partir da biblioteca de cláusulas.
 *
 * Alternativa determinística à geração por IA. A diferença que importa: a IA reescreve o contrato
 * a cada execução, e duas minutas do mesmo serviço saem diferentes. Aqui o texto é o mesmo que o
 * jurídico revisou — só as variáveis mudam.
 *
 * O formulário pede exatamente as variáveis que as cláusulas vigentes declaram, nem uma a mais.
 * Campo em branco não gera minuta com buraco: a ação recusa e diz qual falta.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ds";
import { gerarMinutaDaBiblioteca } from "@/app/admin/contratos/actions";

/** Rótulo humano de cada variável. Nome técnico na tela é o que faz alguém preencher errado. */
const ROTULO: Record<string, string> = {
  cliente_nome: "Nome do cliente",
  mes_proposta: "Mês da proposta",
  fase: "Fase contratada",
  dias_golive: "Dias até o go-live",
  valor_total: "Valor total da implantação",
  parcelas: "Número de parcelas",
  valor_entrada: "Valor da entrada",
  valor_parcela: "Valor de cada parcela",
  dia_vencimento: "Dia do vencimento",
  valor_manutencao: "Mensalidade de manutenção",
  valor_agente: "Parte do agente de IA",
  valor_infra: "Parte da infraestrutura",
  comarca: "Comarca do foro",
};

const EXEMPLO: Record<string, string> = {
  mes_proposta: "junho de 2026", fase: "Fase 1", dias_golive: "10",
  valor_total: "R$ 10.500,00", parcelas: "4", valor_entrada: "R$ 3.000,00",
  valor_parcela: "R$ 2.500,00", dia_vencimento: "26", valor_manutencao: "R$ 1.600,00",
  valor_agente: "R$ 800,00", valor_infra: "R$ 800,00", comarca: "São Paulo/SP",
};

export function MinutaDaBiblioteca({ contractId, variaveis, clienteNome }: {
  contractId: string; variaveis: string[]; clienteNome: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({
    cliente_nome: clienteNome, comarca: "São Paulo/SP",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  // `cliente_nome` já vem do contrato; pedir de novo seria pedir o que o sistema sabe.
  const pedir = variaveis.filter((v) => v !== "cliente_nome");

  if (!aberto) {
    return (
      <div className="mt-3">
        <Button variant="primary" onClick={() => setAberto(true)}>
          Gerar minuta da biblioteca
        </Button>
        <p className="ds-small mt-1">
          Monta o contrato com as cláusulas vigentes, sempre o mesmo texto. As cláusulas ficam
          congeladas neste contrato — editar a biblioteca depois não muda este documento.
        </p>
      </div>
    );
  }

  return (
    <Card title="Gerar minuta da biblioteca" className="mt-3">
      <p className="ds-small mb-4">
        Preencha o que muda de contrato para contrato. O texto das cláusulas é o mesmo revisado
        pelo jurídico.
      </p>
      {erro && <p className="mb-3 text-sm text-[color:var(--danger)]">{erro}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {pedir.map((v) => (
          <Field key={v} label={ROTULO[v] ?? v}>
            {(p) => <Input {...p} value={valores[v] ?? ""} placeholder={EXEMPLO[v] ?? ""}
              onChange={(e) => setValores({ ...valores, [v]: e.target.value })} />}
          </Field>
        ))}
      </div>

      <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
        <Button variant="primary" loading={pendente}
          onClick={() => {
            setErro(null);
            iniciar(async () => {
              try {
                await gerarMinutaDaBiblioteca(contractId, valores);
                setAberto(false);
              } catch (e) { setErro((e as Error).message); }
              finally { router.refresh(); }
            });
          }}>
          Gerar minuta
        </Button>
        <Button variant="ghost" onClick={() => { setAberto(false); setErro(null); }}>Cancelar</Button>
      </div>
    </Card>
  );
}
