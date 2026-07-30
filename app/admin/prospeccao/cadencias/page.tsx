import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CHANNEL_LABELS, ICP_LABELS, type Cadence } from "@/lib/prospecting/types";
import { CadenceEditor } from "@/components/prospecting/CadenceEditor";
import { saveCadence, toggleCadence } from "../ops";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

const CHANNEL_ICON: Record<string, string> = { email: "📧", whatsapp: "💬", linkedin: "🔗", ligacao: "📞" };

export default async function CadenciasPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("cadences").select("*").order("name");
  const list = (data as Cadence[]) ?? [];

  return (
    <ContentArea>
      <div>
        <Link href="/admin/prospeccao" className="text-sm text-muted2 hover:text-gold">← Central</Link>
        <h1 className="font-serif text-4xl font-semibold mt-1 mb-1">Cadências</h1>
        <p className="text-sm text-muted mb-6">Sequências multicanal por ICP (padrão sugerido: 7 toques em 12 dias). Monte visualmente — cada passo tem dia, canal, tipo e a diretriz que o agente segue.</p>

        <div className="space-y-5">
          {list.map((c) => {
            const steps = Array.isArray(c.steps) ? c.steps : [];
            return (
              <div key={c.id} className="card p-6">
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-lg font-semibold">{c.name}</h2>
                    {c.icp && <span className="badge-muted">{ICP_LABELS[c.icp] ?? c.icp}</span>}
                    <span className={c.is_active ? "badge-teal" : "badge-muted"}>{c.is_active ? "Ativa" : "Inativa"}</span>
                    <span className="text-xs text-muted2">{steps.length} passos · {steps.reduce((m, s) => Math.max(m, s.dia ?? 0), 0)} dias</span>
                  </div>
                  <form action={toggleCadence.bind(null, c.id, !c.is_active)}><button className="btn-ghost text-xs">{c.is_active ? "Desativar" : "Ativar"}</button></form>
                </div>

                {/* pré-visualização em timeline */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {steps.map((s, i) => (
                    <span key={i} className="badge-muted" title={s.modelo}>D{s.dia} · {CHANNEL_ICON[s.canal] ?? ""} {CHANNEL_LABELS[s.canal] ?? s.canal}{s.tipo === "tarefa" ? " (tarefa)" : ""}</span>
                  ))}
                </div>

                <details>
                  <summary className="cursor-pointer text-sm text-gold">Editar cadência</summary>
                  <div className="mt-4"><CadenceEditor action={saveCadence} cadence={{ id: c.id, name: c.name, icp: c.icp, steps }} /></div>
                </details>
              </div>
            );
          })}
          {list.length === 0 && <div className="card p-8"><p className="text-sm text-muted2">Nenhuma cadência. Crie uma abaixo.</p></div>}
        </div>

        <div className="card p-6 mt-5 border-goldline">
          <h2 className="font-serif text-lg font-semibold text-gold mb-4">+ Nova cadência</h2>
          <CadenceEditor action={saveCadence} />
        </div>
      </div>
    </ContentArea>
  );
}
