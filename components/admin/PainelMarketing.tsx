"use client";
/**
 * Painel de marketing: de onde vêm os leads, quanto custam, e quantos viram negócio.
 *
 * Paleta categórica validada por script (skill dataviz), não escolhida no olho:
 *   #0891B2 · #DB2777 · #16A34A · #7C3AED · #B45309
 * Passa banda de luminosidade, piso de croma, visão normal e contraste. A separação para
 * deuteranopia fica em ΔE 6,1 — dentro do piso 6–8, o que só é permitido COM codificação
 * secundária. Por isso cada linha leva RÓTULO DIRETO na ponta, além da legenda: a identidade
 * da série nunca depende só da cor. A tabela ao final é a terceira via de leitura.
 *
 * O app não tem modo escuro, então a validação foi feita só para o claro.
 */
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, LabelList, Cell,
} from "recharts";
import { Card, EmptyState } from "@/components/ds";

/** Ordem FIXA. A cor segue a origem, nunca a posição no ranking — filtrar não repinta. */
export const CORES_ORIGEM = ["#0891B2", "#DB2777", "#16A34A", "#7C3AED", "#B45309"] as const;

const TINTA = { forte: "#1A1A2E", media: "#1E2A38", fraca: "#6B7A8D" };
const GRADE = "rgba(13,31,60,.08)";
const MARCA = "#007A94";

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Rótulo direto tem que caber na margem. Nome longo vira o miolo útil dele. */
function curto(nome: string): string {
  const semParenteses = nome.replace(/\s*\(.*\)\s*$/, "").trim();
  return semParenteses.length > 18 ? semParenteses.slice(0, 17) + "…" : semParenteses;
}

/**
 * Duas séries que terminam no mesmo valor recebem rótulos no mesmo pixel — e aí a codificação
 * secundária vira borrão, que é pior que não ter. Empilho quem empata.
 */
function desviosDeRotulo(serie: PontoSerie[], origens: string[]): Record<string, number> {
  const ultimo = serie[serie.length - 1] ?? {};
  const porValor = new Map<number, string[]>();
  for (const o of origens) {
    const v = Number(ultimo[o] ?? 0);
    porValor.set(v, [...(porValor.get(v) ?? []), o]);
  }
  const desvios: Record<string, number> = {};
  for (const grupo of porValor.values()) {
    const meio = (grupo.length - 1) / 2;
    grupo.forEach((o, i) => { desvios[o] = (i - meio) * 14; });
  }
  return desvios;
}

const tooltip = {
  contentStyle: { background: "#FFFFFF", border: "1px solid #E3E8EF", borderRadius: 10, fontSize: 13, color: TINTA.forte },
  labelStyle: { color: TINTA.fraca, marginBottom: 4 },
};
const eixo = { stroke: TINTA.fraca, fontSize: 12, tickLine: false, axisLine: { stroke: GRADE } };

export type PontoSerie = { periodo: string } & Record<string, string | number>;
export type LinhaOrigem = {
  origem: string; leads: number; negocios: number; custoCentavos: number;
};
export type EtapaFunil = { etapa: string; qtd: number; explica: string };

export function PainelMarketing({ serie, origens, funil, porOrigem }: {
  serie: PontoSerie[]; origens: string[]; funil: EtapaFunil[]; porOrigem: LinhaOrigem[];
}) {
  const temSerie = serie.some((p) => origens.some((o) => Number(p[o] ?? 0) > 0));
  const temFunil = funil.some((f) => f.qtd > 0);
  const desvios = desviosDeRotulo(serie, origens);
  const topoFunil = Math.max(1, ...funil.map((f) => f.qtd));

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">
          Leads por origem, semana a semana
        </p>
        {!temSerie ? (
          <div className="mt-4">
            <EmptyState title="Ainda não há leads no período"
              description="Assim que o primeiro formulário for enviado, a curva de cada origem aparece aqui." />
          </div>
        ) : (
          <div className="mt-4" style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={serie} margin={{ top: 12, right: 128, bottom: 4, left: -16 }}>
                <CartesianGrid stroke={GRADE} vertical={false} />
                <XAxis dataKey="periodo" {...eixo} />
                <YAxis allowDecimals={false} {...eixo} />
                <Tooltip {...tooltip} />
                <Legend wrapperStyle={{ fontSize: 13, color: TINTA.media, paddingTop: 8 }} iconType="plainline" />
                {origens.map((o, i) => (
                  <Line key={o} type="monotone" dataKey={o} name={o}
                    stroke={CORES_ORIGEM[i % CORES_ORIGEM.length]} strokeWidth={2}
                    dot={{ r: 4 }} activeDot={{ r: 6, strokeWidth: 2, stroke: "#FFFFFF" }}>
                    {/* rótulo direto: a codificação secundária que o piso de CVD exige */}
                    <LabelList dataKey={o} position="right" content={(props) => {
                      const { index, x, y, value } = props as { index?: number; x?: number; y?: number; value?: number };
                      if (index !== serie.length - 1 || !value) return null;
                      return (
                        <text x={Number(x) + 10} y={Number(y) + 4 + (desvios[o] ?? 0)}
                          fill={TINTA.media} fontSize={11} fontWeight={600}>
                          {curto(o)}
                        </text>
                      );
                    }} />
                  </Line>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">
          Do lead ao cliente
        </p>
        <p className="ds-small mt-1">Quantos sobrevivem a cada passo. A queda entre dois passos é onde está o problema.</p>
        {!temFunil ? (
          <div className="mt-4">
            <EmptyState title="Funil vazio" description="Sem leads capturados, não há o que acompanhar." />
          </div>
        ) : (
          <div className="mt-4" style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              {/* Série única: hue única, sem legenda — o título já nomeia o que é. */}
              <BarChart data={funil} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={GRADE} horizontal={false} />
                <XAxis type="number" allowDecimals={false} domain={[0, topoFunil]} {...eixo} />
                <YAxis type="category" dataKey="etapa" width={92} {...eixo} />
                <Tooltip {...tooltip}
                  formatter={(v: number, _n, p) => [v, (p?.payload as EtapaFunil)?.explica ?? ""]} />
                <Bar dataKey="qtd" radius={[0, 4, 4, 0]} barSize={22}>
                  {funil.map((_, i) => <Cell key={i} fill={MARCA} />)}
                  <LabelList dataKey="qtd" position="right" fill={TINTA.media} fontSize={13} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Tabela: a via de leitura que não depende de cor nenhuma. */}
      <Card className="p-0">
        <div className="border-b border-hairline px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Por origem</p>
        </div>
        {porOrigem.length === 0 ? (
          <div className="p-6"><p className="ds-body">Nenhuma origem com lead ainda.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr>{["Origem", "Leads", "Negócios", "Conversão", "Investido", "Custo/lead"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {porOrigem.map((o, i) => {
                  const conv = o.leads > 0 ? Math.round((o.negocios / o.leads) * 100) : null;
                  return (
                    <tr key={o.origem}>
                      <td className="td">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: CORES_ORIGEM[i % CORES_ORIGEM.length] }} />
                          <span className="font-medium text-[color:var(--fg-1)]">{o.origem}</span>
                        </span>
                      </td>
                      <td className="td font-jbmono text-[color:var(--fg-1)]">{o.leads}</td>
                      <td className="td font-jbmono text-[color:var(--fg-2)]">{o.negocios}</td>
                      <td className="td font-jbmono text-[color:var(--fg-2)]">{conv === null ? "—" : `${conv}%`}</td>
                      <td className="td font-jbmono text-[color:var(--fg-2)]">{reais(o.custoCentavos)}</td>
                      <td className="td font-jbmono text-[color:var(--fg-2)]">
                        {o.leads > 0 && o.custoCentavos > 0 ? reais(Math.round(o.custoCentavos / o.leads)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
