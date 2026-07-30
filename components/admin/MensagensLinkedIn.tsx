"use client";
/**
 * Ingestão das mensagens do LinkedIn do próprio André.
 *
 * A tela empurra para a exportação oficial em vez do caminho automático, e diz por quê: é o
 * próprio LinkedIn entregando o dado, sem raspagem e sem risco de conta. O caminho automático
 * existe, mas não é o que a tela recomenda.
 */
import { useState, useTransition } from "react";
import { dataBR } from "@/lib/formato/data";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Textarea, Badge, EmptyState, Kpi } from "@/components/ds";
import { ingerirCsv } from "@/app/admin/prospeccao/mensagens/actions";

export type ConversaLinha = {
  nome: string; perfilUrl: string | null; prospectId: string | null;
  mensagens: number; sobreIa: number; ultima: string | null; trecho: string | null;
};

const data = dataBR;   // trata coluna `date` sem deixar o fuso puxar o dia para trás

export function MensagensLinkedIn({ conversas, total, sobreIa }: {
  conversas: ConversaLinha[]; total: number; sobreIa: number;
}) {
  const [f, setF] = useState({ csv: "", meuNome: "André Kachan" });
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi value={String(total)} label="Mensagens guardadas" />
        <Kpi value={String(sobreIa)} label="Sobre IA" />
        <Kpi value={String(conversas.length)} label="Conversas sobre o tema" />
      </div>

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      <Card title="Trazer suas mensagens">
        <div className="rounded-[10px] border border-hairline bg-[var(--bg-2)] p-4">
          <p className="ds-small">
            <b>Como pegar o arquivo:</b> no LinkedIn, vá em Configurações → Privacidade de dados →
            Obter uma cópia dos seus dados → marque <b>Mensagens</b> → Solicitar arquivo. O
            LinkedIn manda um e-mail em algumas horas com um .zip; dentro dele está o{" "}
            <b>messages.csv</b>. Abra num editor de texto, copie tudo e cole abaixo.
          </p>
          <p className="ds-small mt-2 text-[color:var(--fg-3)]">
            É o próprio LinkedIn entregando os seus dados — sem raspagem, sem sessão, sem risco
            para a conta.
          </p>
        </div>

        <div className="mt-4">
          <Field label="Seu nome, como aparece nas mensagens"
            hint="A exportação não marca quem enviou e quem recebeu — é o seu nome que diz isso.">
            {(p) => <Input {...p} value={f.meuNome} onChange={(e) => setF({ ...f, meuNome: e.target.value })} />}
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Conteúdo do messages.csv">
            {(p) => <Textarea {...p} rows={8} value={f.csv}
              onChange={(e) => setF({ ...f, csv: e.target.value })}
              placeholder={'CONVERSATION ID,CONVERSATION TITLE,FROM,SENDER PROFILE URL,TO,...'} />}
          </Field>
        </div>
        <div className="mt-5 border-t border-hairline pt-4">
          <Button variant="primary" loading={pendente}
            onClick={() => {
              setErro(null); setAviso(null);
              iniciar(async () => {
                try {
                  const msg = await ingerirCsv(f);
                  setF({ ...f, csv: "" });
                  setAviso(msg);
                } catch (e) { setErro((e as Error).message); }
                /**
                 * `revalidatePath` na Server Action invalida o cache do servidor, mas não força
                 * ESTA árvore a re-renderizar: os contadores do topo ficavam em zero enquanto a
                 * mensagem dizia "3 guardadas". Quem lê os dois conclui que falhou.
                 */
                finally { router.refresh(); }
              });
            }}>
            Trazer mensagens
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="border-b border-hairline px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">
            Quem falou de IA com você
          </p>
          <p className="ds-small mt-1">
            Escrever direto é o gesto mais deliberado que existe antes de marcar uma reunião.
          </p>
        </div>
        {conversas.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Nenhuma conversa sobre IA ainda"
              description="Traga o messages.csv da sua exportação e as conversas que tocaram no tema aparecem aqui." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr>{["Pessoa", "Sobre IA", "Mensagens", "Última", "Trecho"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {conversas.map((c, i) => (
                  <tr key={i}>
                    <td className="td">
                      {c.prospectId ? (
                        <a href={`/admin/prospeccao/${c.prospectId}`} className="font-medium text-[color:var(--brand)] underline">
                          {c.nome}
                        </a>
                      ) : (
                        <span className="font-medium text-[color:var(--fg-1)]">{c.nome}</span>
                      )}
                      {!c.prospectId && <span className="block text-xs text-[color:var(--fg-3)]">fora da base</span>}
                    </td>
                    <td className="td"><Badge tone="brand">{c.sobreIa}</Badge></td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{c.mensagens}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{data(c.ultima)}</td>
                    <td className="td text-xs text-[color:var(--fg-3)]">
                      {c.trecho ? `"${c.trecho}${c.trecho.length >= 140 ? "…" : ""}"` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
