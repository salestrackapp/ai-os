import { ConfigNav } from "@/components/config/ConfigNav";
import { ExtraClausesEditor } from "@/components/config/ExtraClausesEditor";
import { getContractSettings } from "@/lib/settings";
import { saveContractSettings } from "./actions";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

export default async function ContratosConfigPage() {
  const s = await getContractSettings();
  return (
    <ContentArea>
      <div className="max-w-3xl">
        <p className="text-[13px] uppercase tracking-[.24em] text-muted2 mb-1">A Fortaleza · Jurídico</p>
        <h1 className="font-serif text-4xl font-semibold mb-6">Termos do Contrato</h1>
        <ConfigNav />
        <p className="text-sm text-muted mb-5">Estes termos alimentam a minuta gerada a partir de propostas aprovadas. Alterações valem para <b className="text-cream">novos contratos</b> (minutas já geradas não mudam).</p>

        <form action={saveContractSettings} className="space-y-5">
          <div className="card p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold">Contratada</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="label">Razão social</label><input className="input" name="contratada_nome" defaultValue={s.contratada_nome} /></div>
              <div><label className="label">CNPJ</label><input className="input font-mono" name="contratada_cnpj" defaultValue={s.contratada_cnpj} /></div>
              <div><label className="label">Endereço/sede</label><input className="input" name="contratada_endereco" defaultValue={s.contratada_endereco} /></div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold">Parâmetros</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="label">Foro</label><input className="input" name="foro" defaultValue={s.foro} /></div>
              <div><label className="label">Aviso prévio (dias)</label><input className="input font-mono" name="aviso_previo_dias" type="number" defaultValue={s.aviso_previo_dias} /></div>
              <div><label className="label">Validade créditos (meses)</label><input className="input font-mono" name="creditos_validade_meses" type="number" defaultValue={s.creditos_validade_meses} /></div>
              <div><label className="label">Índice de reajuste</label><input className="input" name="reajuste_indice" defaultValue={s.reajuste_indice} /></div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold">Cláusulas</h2>
            <div><label className="label">Plataforma de IA</label><textarea className="input" name="clausula_plataforma" rows={3} defaultValue={s.clausula_plataforma} /></div>
            <div><label className="label">Vigência e rescisão</label><textarea className="input" name="clausula_rescisao" rows={2} defaultValue={s.clausula_rescisao} /></div>
            <div><label className="label">Confidencialidade e PI</label><textarea className="input" name="clausula_confidencialidade" rows={3} defaultValue={s.clausula_confidencialidade} /></div>
            <div><label className="label">LGPD</label><textarea className="input" name="clausula_lgpd" rows={2} defaultValue={s.clausula_lgpd} /></div>
          </div>

          <div className="card p-6">
            <h2 className="font-serif text-xl font-semibold mb-3">Cláusulas extras</h2>
            <ExtraClausesEditor initial={s.clausulas_extras} />
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-gold">Salvar termos</button>
            <p className="text-[13px] text-muted2">Template base — validar com assessoria jurídica antes do primeiro envio real.</p>
          </div>
        </form>
      </div>
    </ContentArea>
  );
}
