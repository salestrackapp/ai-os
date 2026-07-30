"use client";
/**
 * Editor da prova da Academy.
 *
 * A questão e o gabarito aparecem juntos, porque é assim que se pensa uma questão — a separação
 * em duas tabelas existe por segurança (o aluno não pode ler o gabarito) e não deve vazar para
 * quem edita. Marcar a alternativa certa é um clique no rádio ao lado dela.
 */
import { useState, useTransition } from "react";
import { Button, Card, Field, Input, Textarea, Select, Badge } from "@/components/ds";
import { salvarProva, salvarQuestao, excluirQuestao } from "@/app/admin/academy/prova/actions";

export type QuestaoAdmin = {
  id: string; ordem: number; enunciado: string; tipo: "multipla" | "vf";
  alternativas: string[]; gabarito: string | null;
};
export type ProvaAdmin = {
  id: string | null; titulo: string; descricao: string;
  notaMinima: number; tentativasMax: number; exigeConclusao: boolean; ativa: boolean;
};

export function EditorProva({ courseId, cursoTitulo, prova, questoes }: {
  courseId: string; cursoTitulo: string; prova: ProvaAdmin; questoes: QuestaoAdmin[];
}) {
  const [p, setP] = useState(prova);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function guardar() {
    setErro(null); setMsg(null);
    iniciar(async () => {
      try {
        await salvarProva(courseId, {
          titulo: p.titulo, descricao: p.descricao, notaMinima: p.notaMinima,
          tentativasMax: p.tentativasMax, exigeConclusao: p.exigeConclusao, ativa: p.ativa,
        });
        setMsg("Prova salva. O aluno já vê as mudanças.");
      } catch (e) { setErro((e as Error).message); }
    });
  }

  return (
    <div className="space-y-6">
      <Card title={`Prova de "${cursoTitulo}"`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título da prova">{(f) => <Input {...f} value={p.titulo} onChange={(e) => setP({ ...p, titulo: e.target.value })} />}</Field>
          <Field label="Nota mínima para aprovar" hint="Em porcentagem de acertos.">
            {(f) => <Input {...f} type="number" min={0} max={100} value={p.notaMinima}
              onChange={(e) => setP({ ...p, notaMinima: Number(e.target.value) })} />}
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Explicação para o aluno" hint="Aparece acima das questões.">
            {(f) => <Textarea {...f} rows={2} value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} />}
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Tentativas permitidas">
            {(f) => <Input {...f} type="number" min={1} max={20} value={p.tentativasMax}
              onChange={(e) => setP({ ...p, tentativasMax: Number(e.target.value) })} />}
          </Field>
          <Field label="Quando liberar a prova">
            {(f) => (
              <Select {...f} value={p.exigeConclusao ? "sim" : "nao"} onChange={(e) => setP({ ...p, exigeConclusao: e.target.value === "sim" })}>
                <option value="sim">Só depois de concluir todas as tarefas da trilha</option>
                <option value="nao">A qualquer momento</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Situação">
            {(f) => (
              <Select {...f} value={p.ativa ? "sim" : "nao"} onChange={(e) => setP({ ...p, ativa: e.target.value === "sim" })}>
                <option value="sim">Publicada — o aluno pode fazer</option>
                <option value="nao">Rascunho — invisível para o aluno</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
          <Button variant="primary" onClick={guardar} loading={pendente}>Salvar prova</Button>
          {msg && <span className="text-sm font-medium text-[color:var(--success)]">{msg}</span>}
          {erro && <span className="text-sm text-[color:var(--danger)]">{erro}</span>}
        </div>
      </Card>

      {p.id ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="ds-h3">Questões <Badge tone="neutral">{questoes.length}</Badge></h2>
          </div>
          {questoes.map((q) => <LinhaQuestao key={q.id} assessmentId={p.id!} questao={q} />)}
          <LinhaQuestao assessmentId={p.id} novaOrdem={questoes.length} />
        </>
      ) : (
        <Card><p className="ds-body">Salve a prova acima para começar a adicionar questões.</p></Card>
      )}
    </div>
  );
}

function LinhaQuestao({ assessmentId, questao, novaOrdem }: {
  assessmentId: string; questao?: QuestaoAdmin; novaOrdem?: number;
}) {
  const nova = !questao;
  const [enunciado, setEnunciado] = useState(questao?.enunciado ?? "");
  const [tipo, setTipo] = useState<"multipla" | "vf">(questao?.tipo ?? "multipla");
  const [alts, setAlts] = useState<string[]>(questao?.alternativas?.length ? questao.alternativas : ["", "", "", ""]);
  const [gabarito, setGabarito] = useState(questao?.gabarito ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function guardar() {
    setErro(null);
    iniciar(async () => {
      try {
        await salvarQuestao(assessmentId, {
          id: questao?.id, ordem: questao?.ordem ?? novaOrdem ?? 0,
          enunciado, tipo, alternativas: alts, gabarito,
        });
        if (nova) { setEnunciado(""); setAlts(["", "", "", ""]); setGabarito(""); }
      } catch (e) { setErro((e as Error).message); }
    });
  }

  return (
    <Card className={nova ? "border-dashed" : undefined}>
      <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">
        {nova ? "Nova questão" : `Questão ${(questao!.ordem ?? 0) + 1}`}
      </p>
      <div className="mt-3 space-y-4">
        <Field label="Enunciado">
          {(f) => <Textarea {...f} rows={2} value={enunciado} onChange={(e) => setEnunciado(e.target.value)}
            placeholder="Ex.: O que a seção IDENTIDADE do prompt define?" />}
        </Field>
        <Field label="Tipo">
          {(f) => (
            <Select {...f} value={tipo} onChange={(e) => { setTipo(e.target.value as "multipla" | "vf"); setGabarito(""); }}>
              <option value="multipla">Múltipla escolha</option>
              <option value="vf">Verdadeiro ou falso</option>
            </Select>
          )}
        </Field>

        {tipo === "multipla" ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">
              Alternativas — marque a correta
            </p>
            <div className="mt-2 space-y-2">
              {alts.map((a, i) => (
                <label key={i} className="flex items-center gap-3">
                  <input type="radio" name={`gab-${questao?.id ?? "nova"}`} checked={gabarito === String(i)}
                    onChange={() => setGabarito(String(i))} className="accent-[#007A94]" aria-label={`Alternativa ${i + 1} é a correta`} />
                  <input className="input" value={a} placeholder={`Alternativa ${i + 1}`}
                    onChange={(e) => setAlts(alts.map((x, k) => (k === i ? e.target.value : x)))} />
                </label>
              ))}
            </div>
            <button onClick={() => setAlts([...alts, ""])} disabled={alts.length >= 6}
              className="ds-focus mt-2 text-sm font-medium text-[color:var(--brand)] disabled:opacity-40">+ Mais uma alternativa</button>
          </div>
        ) : (
          <Field label="A afirmação é">
            {(f) => (
              <Select {...f} value={gabarito} onChange={(e) => setGabarito(e.target.value)}>
                <option value="">Escolha…</option>
                <option value="V">Verdadeira</option>
                <option value="F">Falsa</option>
              </Select>
            )}
          </Field>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        <Button variant="primary" size="sm" onClick={guardar} loading={pendente}>
          {nova ? "Adicionar questão" : "Salvar questão"}
        </Button>
        {!nova && (
          <Button variant="ghost" size="sm"
            onClick={() => { if (confirm("Excluir esta questão?")) iniciar(async () => { await excluirQuestao(questao!.id); }); }}>
            Excluir
          </Button>
        )}
        {erro && <span className="text-sm text-[color:var(--danger)]">{erro}</span>}
      </div>
    </Card>
  );
}
