"use client";
/**
 * Incidentes de segurança — a tela de quem está no meio de um.
 *
 * ── O que manda no desenho ───────────────────────────────────────────────────────────────────
 * Quem abre esta tela está com adrenalina alta e pouco tempo. Então: abrir um incidente pede duas
 * frases, não um formulário de vinte campos; o relógio do prazo aparece em horas, não em data; e o
 * que falta fazer está dito como próxima ação, não como campo vazio.
 *
 * Detalhe deliberado: o formulário de abertura NÃO pede a data de detecção. Ela é o `now()` do
 * banco, porque é dela que corre o prazo do art. 48 — e um campo editável ali seria um convite a
 * ajustar para trás exatamente a data que prova o cumprimento.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Badge, Field, Input, Textarea, Select, EmptyState } from "@/components/ds";

export type IncidenteLinha = {
  id: string; titulo: string; descricao: string; severidade: string; status: string;
  detectadoEm: string; encerradoEm: string | null;
  dadosAfetados: string | null; causa: string | null; acoes: string | null;
  riscoRelevante: boolean | null; justificativaRisco: string | null;
  anpdEm: string | null; titularesEm: string | null;
};

const SEV: Record<string, { rotulo: string; tom: "neutral" | "warn" | "danger" }> = {
  baixa: { rotulo: "baixa", tom: "neutral" },
  media: { rotulo: "média", tom: "warn" },
  alta: { rotulo: "alta", tom: "danger" },
  critica: { rotulo: "crítica", tom: "danger" },
};

const STATUS: Record<string, string> = {
  aberto: "Aberto", em_analise: "Em análise", contido: "Contido", encerrado: "Encerrado",
};

/** O art. 48 corre da ciência. A ANPD orienta 2 dias úteis — aqui em horas, que é como se sente. */
function relogio(detectadoEm: string): { texto: string; tom: "success" | "warn" | "danger" } {
  const horas = Math.floor((Date.now() - new Date(detectadoEm).getTime()) / 3600000);
  if (horas < 24) return { texto: `${horas}h desde a detecção`, tom: "success" };
  if (horas < 48) return { texto: `${Math.floor(horas / 24)} dia desde a detecção`, tom: "warn" };
  return { texto: `${Math.floor(horas / 24)} dias desde a detecção`, tom: "danger" };
}

/** O que falta, dito como ação. Campo vazio não avisa ninguém; frase avisa. */
function proximaAcao(i: IncidenteLinha): string | null {
  if (i.status === "encerrado") return null;
  if (i.riscoRelevante === null) return "Decida se há risco relevante ao titular — é o que define se comunica.";
  if (i.riscoRelevante && !i.anpdEm) return "Risco relevante: comunique a ANPD.";
  if (i.riscoRelevante && !i.titularesEm) return "Risco relevante: comunique as pessoas afetadas.";
  if (!i.causa) return "Registre a causa antes de encerrar.";
  if (!i.acoes) return "Registre o que foi feito antes de encerrar.";
  return "Pode encerrar.";
}

export function Incidentes({ incidentes }: { incidentes: IncidenteLinha[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [runbook, setRunbook] = useState(false);

  const rodar = (fn: () => Promise<unknown>) =>
    iniciar(async () => {
      setErro(null);
      try { await fn(); router.refresh(); } catch (e) { setErro((e as Error).message); }
    });

  const emAndamento = incidentes.filter((i) => i.status !== "encerrado");

  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">
              {emAndamento.length ? `${emAndamento.length} incidente(s) em andamento` : "Nenhum incidente em andamento"}
            </p>
            <p className="ds-small !mt-1">
              Na dúvida, registre. Alarme falso custa cinco minutos; incidente real tratado de
              improviso custa o prazo do art. 48 — que corre de <b>quando soubemos</b>, não de
              quando terminamos de entender.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRunbook(!runbook)}>
              {runbook ? "Fechar" : "Primeira hora"}
            </Button>
            <Button onClick={() => setAbrindo(!abrindo)}>{abrindo ? "Cancelar" : "Registrar incidente"}</Button>
          </div>
        </div>

        {runbook && <PrimeiraHora />}

        {abrindo && <FormularioAbertura pendente={pendente} onCancelar={() => setAbrindo(false)}
          onAbrir={(d) => rodar(async () => {
            const { abrirIncidenteAction } = await import("@/app/admin/lgpd/incidentes/actions");
            await abrirIncidenteAction(d); setAbrindo(false);
          })} />}

        {erro && <p className="mt-3 rounded-ds-input bg-[#FDECEC] px-3 py-2 font-montserrat text-[13px] text-[#B42318]">{erro}</p>}
      </Card>

      {incidentes.length === 0 ? (
        <EmptyState title="Nenhum incidente registrado"
          description="É o estado desejado — e também o estado de quem nunca registrou nada. O runbook diz o que conta como incidente; vale ler uma vez antes de precisar." />
      ) : (
        <div className="space-y-3">
          {incidentes.map((i) => {
            const r = relogio(i.detectadoEm);
            const acao = proximaAcao(i);
            return (
              <Card key={i.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">{i.titulo}</p>
                    <p className="ds-small !mt-0.5">
                      {STATUS[i.status] ?? i.status} · {i.status === "encerrado" && i.encerradoEm
                        ? `encerrado em ${new Date(i.encerradoEm).toLocaleDateString("pt-BR")}`
                        : r.texto}
                    </p>
                  </div>
                  <Badge tone={SEV[i.severidade]?.tom ?? "neutral"}>{SEV[i.severidade]?.rotulo ?? i.severidade}</Badge>
                  <Button variant="ghost" onClick={() => setAberto(aberto === i.id ? null : i.id)}>
                    {aberto === i.id ? "Fechar" : "Abrir"}
                  </Button>
                </div>

                {acao && (
                  <p className={`mt-3 rounded-ds-input px-3 py-2 font-montserrat text-[13px] ${
                    acao === "Pode encerrar." ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FFF7E6] text-[color:var(--fg-1)]"}`}>
                    <b>Próximo passo:</b> {acao}
                  </p>
                )}

                {aberto === i.id && <Detalhe i={i} pendente={pendente} rodar={rodar} />}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/**
 * A primeira hora, dentro da tela.
 *
 * Mora aqui, e não atrás de um link para o documento no repositório, por um motivo prático: no meio
 * de um incidente a última coisa que se quer é depender de outra aba, outro login e uma página que
 * pode não abrir. O runbook completo continua em `docs/RUNBOOK_INCIDENTE.md`; o que decide os
 * primeiros minutos está aqui.
 */
function PrimeiraHora() {
  const passos: { titulo: string; texto: string }[] = [
    {
      titulo: "1 · Pare o sangramento — minutos, não horas",
      texto: "Chave exposta: rotacione no fornecedor ANTES de investigar como vazou — chave exposta é chave comprometida, mesmo que “ninguém viu”. Conta invadida: troque a senha, encerre as sessões no Supabase Auth e ative MFA nela. Falha de isolamento entre clientes: desligue a tela afetada em vez de corrigir a política sob pressão. Envio errado: pare a campanha, e não mande um segundo e-mail pedindo para ignorar o primeiro antes de decidir o passo 4.",
    },
    {
      titulo: "2 · Registre agora, mesmo sem saber o tamanho",
      texto: "O relógio do art. 48 começa quando você soube — e é o botão “Registrar incidente” que carimba esse instante. Título e descrição podem ser uma linha; o resto se refina depois. Preencher a data “certa” mais tarde é reescrever a própria prova.",
    },
    {
      titulo: "3 · Preserve o que explica",
      texto: "Não apague log, não force push, não limpe a tabela suspeita. A trilha de auditoria é insert-only justamente para este momento — é ela que vai dizer quem fez o quê.",
    },
    {
      titulo: "4 · Decida se há risco relevante à pessoa",
      texto: "Pese: que dado (e-mail corporativo pesa menos que CPF ou conteúdo de conversa), quantas pessoas, se dá para identificar alguém, se o dado saiu mesmo ou só ficou acessível, e se dá para reverter. Havendo risco relevante, comunique a ANPD e as pessoas — a orientação é de 2 dias úteis da ciência.",
    },
  ];

  return (
    <div className="mt-5 space-y-3 border-t border-[color:var(--border)] pt-5">
      {passos.map((p) => (
        <div key={p.titulo}>
          <p className="font-montserrat text-[13.5px] font-semibold text-[color:var(--fg-1)]">{p.titulo}</p>
          <p className="font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-2)]">{p.texto}</p>
        </div>
      ))}
      <p className="rounded-ds-input bg-[#FFF7E6] px-3 py-2 font-montserrat text-[12.5px] leading-relaxed text-[color:var(--fg-1)]">
        Hoje o MFA do administrador está desligado e a proteção contra senha vazada também. São dois
        cliques, e enquanto não forem dados, “conta de admin acessada por quem não devia” é o
        cenário mais provável desta lista.
      </p>
    </div>
  );
}

function FormularioAbertura({ pendente, onAbrir, onCancelar }: {
  pendente: boolean;
  onAbrir: (d: { titulo: string; descricao: string; severidade: string; dadosAfetados?: string }) => void;
  onCancelar: () => void;
}) {
  const [f, setF] = useState({ titulo: "", descricao: "", severidade: "media", dadosAfetados: "" });
  return (
    <div className="mt-5 space-y-4 border-t border-[color:var(--border)] pt-5">
      <p className="ds-small">
        Duas frases bastam agora. O relógio começa no momento em que você salvar — refina-se o
        resto depois, com calma.
      </p>
      <Field label="O que aconteceu" hint="Uma linha. Ex.: “chave do Resend apareceu num print no WhatsApp”.">
        {(p) => <Input {...p} value={f.titulo} onChange={(e) => setF((a) => ({ ...a, titulo: e.target.value }))} />}
      </Field>
      <Field label="Detalhe" hint="Como você soube, e o que já fez.">
        {(p) => <Textarea {...p} rows={3} value={f.descricao} onChange={(e) => setF((a) => ({ ...a, descricao: e.target.value }))} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gravidade">
          {(p) => (
            <Select {...p} value={f.severidade} onChange={(e) => setF((a) => ({ ...a, severidade: e.target.value }))}>
              <option value="baixa">Baixa — sem dado pessoal exposto</option>
              <option value="media">Média — exposição possível, não confirmada</option>
              <option value="alta">Alta — dado pessoal exposto</option>
              <option value="critica">Crítica — dado sensível ou muitas pessoas</option>
            </Select>
          )}
        </Field>
        <Field label="Que dados podem ter sido afetados" hint="Opcional agora.">
          {(p) => <Input {...p} value={f.dadosAfetados} onChange={(e) => setF((a) => ({ ...a, dadosAfetados: e.target.value }))} />}
        </Field>
      </div>
      <div className="flex gap-2">
        <Button disabled={pendente} onClick={() => onAbrir(f)}>{pendente ? "Registrando…" : "Registrar e começar o relógio"}</Button>
        <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  );
}

function Detalhe({ i, pendente, rodar }: {
  i: IncidenteLinha; pendente: boolean; rodar: (fn: () => Promise<unknown>) => void;
}) {
  const [just, setJust] = useState(i.justificativaRisco ?? "");
  const [f, setF] = useState({ causa: i.causa ?? "", acoes: i.acoes ?? "", status: i.status });

  const atualizar = (campos: Record<string, string>) => rodar(async () => {
    const { atualizarIncidenteAction } = await import("@/app/admin/lgpd/incidentes/actions");
    await atualizarIncidenteAction(i.id, campos);
  });

  return (
    <div className="mt-5 space-y-5 border-t border-[color:var(--border)] pt-5">
      <p className="font-montserrat text-[13.5px] leading-relaxed text-[color:var(--fg-2)]">{i.descricao}</p>

      <div>
        <p className="ds-eyebrow mb-2">Há risco relevante ao titular?</p>
        <p className="ds-small !mt-0 mb-3">
          É a decisão que define se comunica. Ela precisa de razão escrita <b>nos dois sentidos</b> —
          decidir não comunicar é legítimo, e é justamente a decisão que vai ser questionada depois.
        </p>
        {i.riscoRelevante !== null && (
          <p className="mb-3 rounded-ds-input bg-[var(--bg-2)] px-3 py-2 font-montserrat text-[13px] text-[color:var(--fg-2)]">
            Decidido: <b>{i.riscoRelevante ? "há risco relevante" : "sem risco relevante"}</b> — {i.justificativaRisco}
          </p>
        )}
        <Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)}
          placeholder="Por quê? Que dado, quantas pessoas, dá para identificar alguém, dá para reverter." />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={pendente} onClick={() => rodar(async () => {
            const { decidirRiscoAction } = await import("@/app/admin/lgpd/incidentes/actions");
            await decidirRiscoAction(i.id, true, just);
          })}>Há risco relevante</Button>
          <Button variant="ghost" disabled={pendente} onClick={() => rodar(async () => {
            const { decidirRiscoAction } = await import("@/app/admin/lgpd/incidentes/actions");
            await decidirRiscoAction(i.id, false, just);
          })}>Não há risco relevante</Button>
        </div>
      </div>

      {i.riscoRelevante && (
        <div>
          <p className="ds-eyebrow mb-2">Comunicação</p>
          <div className="flex flex-wrap items-center gap-3">
            {i.anpdEm
              ? <Badge tone="success">ANPD comunicada em {new Date(i.anpdEm).toLocaleDateString("pt-BR")}</Badge>
              : <Button variant="secondary" disabled={pendente} onClick={() => rodar(async () => {
                  const { registrarComunicacaoAction } = await import("@/app/admin/lgpd/incidentes/actions");
                  await registrarComunicacaoAction(i.id, "anpd");
                })}>Registrar comunicação à ANPD</Button>}
            {i.titularesEm
              ? <Badge tone="success">Pessoas avisadas em {new Date(i.titularesEm).toLocaleDateString("pt-BR")}</Badge>
              : <Button variant="secondary" disabled={pendente} onClick={() => rodar(async () => {
                  const { registrarComunicacaoAction } = await import("@/app/admin/lgpd/incidentes/actions");
                  await registrarComunicacaoAction(i.id, "titulares");
                })}>Registrar aviso às pessoas</Button>}
          </div>
          <p className="ds-small mt-2">
            Comunicação à ANPD: <a className="underline" href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">gov.br/anpd</a>.
            Orientação é de 2 dias úteis da ciência.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Causa" hint="O que permitiu que acontecesse.">
          {(p) => <Textarea {...p} rows={2} value={f.causa} onChange={(e) => setF((a) => ({ ...a, causa: e.target.value }))} />}
        </Field>
        <Field label="O que foi feito" hint="Contenção e correção.">
          {(p) => <Textarea {...p} rows={2} value={f.acoes} onChange={(e) => setF((a) => ({ ...a, acoes: e.target.value }))} />}
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Situação" className="max-w-[220px]">
          {(p) => (
            <Select {...p} value={f.status} onChange={(e) => setF((a) => ({ ...a, status: e.target.value }))}>
              {Object.entries(STATUS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Select>
          )}
        </Field>
        <Button disabled={pendente} onClick={() => atualizar(f)}>{pendente ? "Salvando…" : "Salvar"}</Button>
      </div>
    </div>
  );
}
