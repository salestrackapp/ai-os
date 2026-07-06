"use client";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

// Paleta v2 clara (PROMPT REV): violeta como acento, verde sucesso, muted ink-cinza, grid hairline.
const GOLD = "#4F1FFF", TEAL = "#18A06B", MUTED = "#6B6B7C", LINE = "rgba(17,12,46,.10)";
const brlShort = (v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`;

const tip = {
  contentStyle: { background: "#FFFFFF", border: "1px solid #E7E4F1", borderRadius: 10, fontSize: 12, color: "#0B0B16" },
  labelStyle: { color: "#6B6B7C" }, cursor: { fill: "rgba(79, 31, 255,.08)" },
};
const axis = { stroke: MUTED, fontSize: 11, tickLine: false };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="label mb-4">{title}</p>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardCharts({ funnel, weekly, byIcp, split }: {
  funnel: { stage: string; qtd: number; valor: number }[];
  weekly: { week: string; count: number }[];
  byIcp: { icp: string; valor: number }[];
  split: { name: string; valor: number; qtd: number }[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <Panel title="Funil por estágio (quantidade)">
        <BarChart data={funnel} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={LINE} vertical={false} />
          <XAxis dataKey="stage" {...axis} /><YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tip} />
          <Bar dataKey="qtd" name="Deals" fill={GOLD} radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>

      <Panel title="Valor no funil por estágio">
        <BarChart data={funnel} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={LINE} vertical={false} />
          <XAxis dataKey="stage" {...axis} /><YAxis {...axis} tickFormatter={brlShort} width={54} />
          <Tooltip {...tip} formatter={(v: number) => brlShort(v)} />
          <Bar dataKey="valor" name="Valor" fill={TEAL} radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>

      <Panel title="Deals criados por semana (12)">
        <LineChart data={weekly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={LINE} vertical={false} />
          <XAxis dataKey="week" {...axis} /><YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey="count" name="Novos" stroke={GOLD} strokeWidth={2} dot={{ r: 2, fill: GOLD }} />
        </LineChart>
      </Panel>

      <Panel title="Valor por ICP · split AK × Salestrack">
        <div className="flex h-full">
          <ResponsiveContainer width="55%" height="100%">
            <BarChart data={byIcp} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={LINE} vertical={false} />
              <XAxis dataKey="icp" {...axis} /><YAxis {...axis} tickFormatter={brlShort} width={54} />
              <Tooltip {...tip} formatter={(v: number) => brlShort(v)} />
              <Bar dataKey="valor" name="Valor" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="45%" height="100%">
            <PieChart>
              <Pie data={split} dataKey="valor" nameKey="name" innerRadius={38} outerRadius={64} paddingAngle={3}>
                {split.map((s, i) => <Cell key={i} fill={i === 0 ? GOLD : TEAL} />)}
              </Pie>
              <Tooltip {...tip} formatter={(v: number) => brlShort(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
