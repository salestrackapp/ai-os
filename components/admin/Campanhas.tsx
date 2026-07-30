"use client";
/**
 * Campanhas de marketing: criar, acompanhar e encerrar.
 *
 * A coluna que importa é "leads": é ela que responde se a campanha trouxe alguém. Custo por
 * lead só aparece quando há lead — dividir por zero e mostrar "—" é mais honesto que exibir
 * um número que não significa nada.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea, Badge, EmptyState, Kpi } from "@/components/ds";
import { salvarCampanha, encerrarCampanha } from "@/app/admin/marketing/actions";

export type Origem = { id: string; slug: string; nome: string };
export type CampanhaLinha = {
  id: string; nome: string; canal: string; status: string; inicio: string; fim: string | null;
  custoCentavos: number; metaLeads: number | null; origem: string | null; leads: number; toques: number;
};

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const TOM: Record<string, "success" | "warn" | "neutral"> = {
  ativa: "success", planejada: "warn", encerrada: "neutral", cancelada: "neutral",
};
const CANAIS = ["conteudo", "social", "anuncio", "email", "evento", "indicacao", "site", "prospeccao", "outro"];

export function Campanhas({ campanhas, origens }: { campanhas: CampanhaLinha[]; origens: Origem[] }) {
  const [abrindo, setAbrindo] = useState(false);
  const [f, setF] = useState({
    nome: "", canal: "conteudo", leadSourceId: "", inicio: new Date().toISOString().slice(0, 10),
    fim: "", custoReais: "", metaLeads: "", status: "planejada", observacao: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const totalLeads = campanhas.reduce((s, c) => s + c.leads, 0);
  const totalCusto = campanhas.reduce((s, c) => s + c.custoCentavos, 0);
  const ativas = campanhas.filter((c) => c.status === "ativa").length;

  function salvar() {
    setErro(null);
    iniciar(async () => {
      try {
        await salvarCampanha(f);
        setAbrindo(false);
        setF({ ...f, nome: "", custoReais: "", metaLeads: "", observacao: "" });
      } catch (e) { setErro((e as Error).message); }
      // Sem isto a campanha nova não aparece na lista até alguém recarregar a página.
      finally { router.refresh(); }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi value={String(totalLeads)} label="Leads atribuídos" />
        <Kpi value={reais(totalCusto)} label="Investido no período" />
        <Kpi value={String(ativas)} label="Campanhas ativas" />
      </div>

      {abrindo ? (
        <Card title="Nova campanha">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">{(p) => <Input {...p} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Série sobre agentes no LinkedIn" />}</Field>
            <Field label="Canal">
              {(p) => <Select {...p} value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>
                {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>}
            </Field>
            <Field label="Origem do lead" hint="Onde a pessoa chega. É o que liga a campanha ao lead capturado.">
              {(p) => <Select {...p} value={f.leadSourceId} onChange={(e) => setF({ ...f, leadSourceId: e.target.value })}>
                <option value="">— sem origem específica —</option>
                {origens.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </Select>}
            </Field>
            <Field label="Situação">
              {(p) => <Select {...p} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                <option value="planejada">Planejada</option>
                <option value="ativa">Ativa — já credita leads</option>
                <option value="encerrada">Encerrada</option>
              </Select>}
            </Field>
            <Field label="Início">{(p) => <Input {...p} type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />}</Field>
            <Field label="Fim" hint="Deixe vazio se não tem data para acabar.">{(p) => <Input {...p} type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />}</Field>
            <Field label="Investimento (R$)">{(p) => <Input {...p} inputMode="decimal" value={f.custoReais} onChange={(e) => setF({ ...f, custoReais: e.target.value })} placeholder="0" />}</Field>
            <Field label="Meta de leads">{(p) => <Input {...p} type="number" min={0} value={f.metaLeads} onChange={(e) => setF({ ...f, metaLeads: e.target.value })} />}</Field>
          </div>
          <div className="mt-4">
            <Field label="Observação">{(p) => <Textarea {...p} rows={2} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />}</Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
            <Button variant="primary" onClick={salvar} loading={pendente}>Salvar campanha</Button>
            <Button variant="ghost" onClick={() => setAbrindo(false)}>Cancelar</Button>
            {erro && <span className="text-sm text-[color:var(--danger)]">{erro}</span>}
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setAbrindo(true)}>Nova campanha</Button>
      )}

      {campanhas.length === 0 ? (
        <EmptyState title="Nenhuma campanha ainda"
          description="Crie uma campanha para saber quanto cada esforço de marketing trouxe de lead — e a que custo." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr>
                {["Campanha", "Situação", "Período", "Investido", "Leads", "Custo/lead", ""].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody>
                {campanhas.map((c) => (
                  <tr key={c.id}>
                    <td className="td">
                      <span className="block font-medium text-[color:var(--fg-1)]">{c.nome}</span>
                      <span className="block text-xs text-[color:var(--fg-3)]">{c.canal}{c.origem ? ` · ${c.origem}` : ""}</span>
                    </td>
                    <td className="td"><Badge tone={TOM[c.status] ?? "neutral"}>{c.status}</Badge></td>
                    <td className="td text-[color:var(--fg-2)]">
                      {new Date(c.inicio).toLocaleDateString("pt-BR")}
                      {c.fim ? ` → ${new Date(c.fim).toLocaleDateString("pt-BR")}` : " → em aberto"}
                    </td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{reais(c.custoCentavos)}</td>
                    <td className="td">
                      <span className="font-jbmono font-semibold text-[color:var(--fg-1)]">{c.leads}</span>
                      {c.metaLeads ? <span className="text-xs text-[color:var(--fg-3)]"> / {c.metaLeads}</span> : null}
                    </td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">
                      {c.leads > 0 && c.custoCentavos > 0 ? reais(Math.round(c.custoCentavos / c.leads)) : "—"}
                    </td>
                    <td className="td text-right">
                      {c.status !== "encerrada" && (
                        <Button variant="ghost" size="sm"
                          onClick={() => { if (confirm(`Encerrar "${c.nome}"?`)) iniciar(async () => { await encerrarCampanha(c.id); router.refresh(); }); }}>
                          Encerrar
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
  );
}
