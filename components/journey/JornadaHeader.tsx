import { Card, Badge } from "@/components/ds";
import { JOURNEY_STAGES, type StageState, type JourneyRow } from "@/lib/journey";
import { avancarFichaAction, ownerFichaAction, proximaAcaoFichaAction } from "@/app/admin/clientes/[id]/actions";

/** Cabeçalho da jornada na ficha do cliente (U3): stepper das 6 etapas + próxima ação + avançar/owner. */
export function JornadaHeader({ row, states, projectId, ownerNome, isMine }:
  { row: JourneyRow; states: StageState[]; projectId: string; ownerNome: string | null; isMine: boolean }) {
  const statusDe = (etapa: number) => states.find((s) => s.etapa === etapa)?.status ?? "pendente";
  const atual = row.etapaAtual;

  return (
    <Card className="mb-6" bloom>
      {/* stepper */}
      <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
        {JOURNEY_STAGES.map((s) => {
          const st = statusDe(s.etapa);
          const isAtual = s.etapa === atual;
          const cor = st === "concluido" ? "var(--success)" : isAtual ? "var(--brand)" : "var(--border)";
          return (
            <div key={s.etapa} className="min-w-[104px] flex-1">
              <div className="h-1.5 rounded-full" style={{ background: cor }} />
              <p className={`mt-2 font-montserrat text-[12px] ${isAtual ? "font-semibold text-[color:var(--fg-1)]" : "text-[color:var(--fg-3)]"}`}>{s.titulo}</p>
              <p className="font-montserrat text-[10.5px] text-[color:var(--fg-4)]">{st === "concluido" ? "concluído" : isAtual ? "em andamento" : "pendente"}</p>
            </div>
          );
        })}
      </div>

      {/* próxima ação + controles */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone="brand">Etapa: {row.etapaTitulo}</Badge>
            {row.atrasada && <Badge tone="warn">atrasada</Badge>}
            <span className="font-jbmono text-[11px] text-[color:var(--fg-4)]">{row.progresso}% da jornada</span>
            {row.owner && <span className="font-montserrat text-[11px] text-[color:var(--fg-3)]">· resp.: {ownerNome ?? "membro"}</span>}
          </div>
          <p className="font-montserrat text-[14px] text-[color:var(--fg-1)]"><span className="text-[color:var(--fg-4)]">Próximo:</span> <b>{row.proximaAcao}</b></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isMine
            ? <form action={ownerFichaAction.bind(null, projectId, atual, row.orgId, false)}><button className="ds-focus rounded-ds-input border border-hairline-strong px-3 h-10 font-montserrat text-[12px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Soltar</button></form>
            : <form action={ownerFichaAction.bind(null, projectId, atual, row.orgId, true)}><button className="ds-focus rounded-ds-input border border-hairline-strong px-3 h-10 font-montserrat text-[12px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Assumir</button></form>}
          <form action={avancarFichaAction.bind(null, projectId, row.orgId)}>
            <button className="ds-focus inline-flex h-10 items-center rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">Concluir etapa →</button>
          </form>
        </div>
      </div>

      {/* editar próxima ação (discreto) */}
      <form action={proximaAcaoFichaAction.bind(null, projectId, atual, row.orgId)} className="mt-3 flex items-center gap-2">
        <input name="acao" defaultValue={row.proximaAcao} placeholder="Descreva a próxima ação…" className="h-9 flex-1 rounded-ds-input border border-hairline bg-[var(--bg-1)] px-3 font-montserrat text-[12.5px] text-[color:var(--fg-1)] outline-none focus:border-[color:var(--brand-light)]" />
        <button className="ds-focus rounded-ds-input border border-hairline-strong px-3 h-9 font-montserrat text-[12px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Salvar ação</button>
      </form>
    </Card>
  );
}
