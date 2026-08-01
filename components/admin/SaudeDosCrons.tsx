import { Card, Badge } from "@/components/ds";
import { CRONS, type SaudeDoCron } from "@/lib/ops/cron";

/**
 * Quais rotinas automáticas rodaram, e quais deixaram de rodar.
 *
 * ── Por que uma tela, e não só a tabela ───────────────────────────────────────────────────────
 * O registro sozinho não resolve nada: dado de saúde que ninguém abre é igual a não ter dado. O
 * que faz diferença é a linha aparecer VERMELHA num lugar que já se olha — e por isso isto mora na
 * Administração, junto de custos e fornecedores, e não numa tela de diagnóstico à parte.
 *
 * ── "Não fez nada" é bom, e precisa parecer bom ───────────────────────────────────────────────
 * A maior parte das rodadas não encontra trabalho: cadência sem inscrito, fila sem tarefa vencida.
 * Se isso aparecesse como problema, a tela viraria um mar de amarelo e ninguém olharia mais. O que
 * é problema é NÃO TER RODADO — ou ter rodado e falhado.
 */
export function SaudeDosCrons({ saude }: { saude: SaudeDoCron[] }) {
  const detalhe = Object.fromEntries(CRONS.map((c) => [c.nome, c]));
  const quebrados = saude.filter((s) => s.suspeito);
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "nunca";

  return (
    <Card className="mb-6">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Rotinas automáticas</p>
        <Badge tone={quebrados.length ? "warn" : "success"}>
          {quebrados.length ? `${quebrados.length} sem rodar` : `${saude.length} em dia`}
        </Badge>
      </div>
      <p className="ds-small !mt-0 mb-4">
        Cada rotina grava uma linha toda vez que roda — <b>inclusive quando não encontra trabalho</b>.
        É o que distingue &ldquo;rodou e não havia nada&rdquo; de &ldquo;parou de rodar&rdquo;, que
        de fora produzem exatamente o mesmo silêncio.
      </p>

      <ul className="divide-y divide-[color:var(--border)]">
        {saude.map((s) => (
          <li key={s.nome} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${s.suspeito ? "bg-[var(--danger)]" : "bg-[var(--success)]"}`} />
            <span className="min-w-0 flex-1">
              <span className="block font-montserrat text-[13.5px] font-medium text-[color:var(--fg-1)]">
                {detalhe[s.nome]?.oQueFaz ?? s.nome}
              </span>
              <span className="block font-montserrat text-[12.5px] text-[color:var(--fg-3)]">
                {detalhe[s.nome]?.horario} · última: {fmt(s.ultima)}
                {s.horasDesde != null && s.horasDesde > 36 && ` — há ${Math.floor(s.horasDesde / 24)} dia(s)`}
              </span>
              {s.erro && <span className="block font-montserrat text-[12.5px] text-[#B42318]">{s.erro}</span>}
            </span>
            {!s.ultima
              ? <Badge tone="danger">nunca rodou</Badge>
              : !s.ok ? <Badge tone="danger">falhou</Badge>
              : s.suspeito ? <Badge tone="warn">atrasada</Badge>
              : <Badge tone="neutral">{resumir(s.resumo)}</Badge>}
          </li>
        ))}
      </ul>

      {quebrados.some((q) => !q.ultima) && (
        <p className="mt-3 rounded-ds-input bg-[#FFF7E6] px-3 py-2 font-montserrat text-[12.5px] leading-snug text-[color:var(--fg-1)]">
          Rotina marcada como <b>&ldquo;nunca rodou&rdquo;</b> pode simplesmente não ter chegado a
          hora dela desde que este registro passou a existir. Se continuar assim depois de um dia
          inteiro, o agendador não está disparando — a causa mais provável é limite de crons do
          plano da Vercel.
        </p>
      )}
    </Card>
  );
}

/** O resumo em uma palavra: o número que mais diz sobre a rodada, ou "sem trabalho". */
function resumir(resumo: Record<string, unknown>): string {
  const numeros: string[] = [];
  const varrer = (o: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "number" && v > 0) numeros.push(`${v} ${k}`);
      else if (v && typeof v === "object") varrer(v as Record<string, unknown>);
    }
  };
  varrer(resumo);
  return numeros.length ? numeros.slice(0, 2).join(" · ") : "sem trabalho";
}
