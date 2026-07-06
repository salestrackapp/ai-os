import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { googleConfigured } from "@/lib/google";
import { recommendTemplate } from "@/lib/templates/recommend";
import { provisionAction } from "../actions";
import { Icon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function NovoTenant({ searchParams }: { searchParams: Promise<{ deal?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: plans }, { data: templates }, { data: deal }] = await Promise.all([
    supabase.from("plans").select("key, name").order("ordem"),
    supabase.from("program_templates").select("key, name").eq("is_active", true).order("name"),
    sp.deal ? supabase.from("deals").select("id, title, value_estimated, org_id").eq("id", sp.deal).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // prefill vindo de deal ganho
  let prefName = "", prefFee = 0;
  if (deal) { prefName = deal.title; prefFee = 0; if (deal.org_id) { const { data: o } = await supabase.from("organizations").select("name").eq("id", deal.org_id).single(); prefName = o?.name ?? deal.title; } }
  // recomendação de template por setor (fallback por regra)
  const rec = await recommendTemplate({ dealId: sp.deal ?? null });
  const recValid = (templates ?? []).some((t) => t.key === rec.templateKey);
  const defaultTemplate = recValid ? rec.templateKey : ((templates ?? [])[0]?.key ?? "");

  return (
    <div className="max-w-3xl">
      <Link href="/admin/onboarding" className="text-sm text-muted2 hover:text-gold">← Onboarding</Link>
      <h1 className="font-serif text-4xl font-semibold mt-2 mb-1">Novo tenant</h1>
      <p className="text-sm text-muted mb-6">{deal ? "Pré-preenchido a partir do deal ganho." : "Cria o cliente ponta a ponta: org, marca, plano, programa, convite e checklist — sem banco manual."}</p>

      <form action={provisionAction} className="space-y-6">
        {sp.deal && <input type="hidden" name="deal_id" value={sp.deal} />}

        <div className="card p-6 space-y-3">
          <p className="label">1 · Cliente</p>
          <input name="name" defaultValue={prefName} required className="input w-full" placeholder="Nome do cliente / empresa*" />
        </div>

        <div className="card p-6 space-y-3">
          <p className="label">2 · Plano & marca</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Plano</label><select name="plan_key" className="input w-full" defaultValue="pro">{(plans ?? []).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></div>
            <div><label className="label">Mensalidade (R$)</label><input name="monthly_platform_fee" type="number" step="0.01" defaultValue={prefFee} className="input w-full" /></div>
            <div><label className="label">Nível white-label</label><select name="branding_level" className="input w-full" defaultValue="n1_padrao"><option value="n1_padrao">N1 · Padrão</option><option value="n2_personalizado">N2 · Tema próprio</option><option value="n3_whitelabel">N3 · Domínio próprio</option></select></div>
            <div><label className="label">Cor de acento</label><input name="color_accent" className="input w-full" placeholder="#4F1FFF" /></div>
            <div className="sm:col-span-2"><label className="label">Logo URL</label><input name="logo_url" className="input w-full" placeholder="https://…" /></div>
            <div className="sm:col-span-2"><label className="label">Nome exibido (opcional)</label><input name="internal_name" defaultValue={prefName} className="input w-full" /></div>
          </div>
        </div>

        <div className="card p-6 space-y-3">
          <p className="label">3 · Programa</p>
          <select name="template_key" className="input w-full" defaultValue={defaultTemplate}>
            <option value="">— programa mínimo —</option>
            {(templates ?? []).map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
          <p className="text-[11px] text-gold mt-1"><Icon name="sparkles" size={12} className="inline -mt-0.5" /> Recomendado: <b>{(templates ?? []).find((t) => t.key === rec.templateKey)?.name ?? rec.templateKey}</b> — {rec.justificativa}{rec.fallback ? " (regra de fallback)" : ""}</p>
          <p className="text-[11px] text-muted2">O template monta projeto, entregáveis, timeline e biblioteca inicial. Sem template → programa mínimo válido.</p>
        </div>

        <div className="card p-6 space-y-3">
          <p className="label">4 · Admin do cliente</p>
          <input name="admin_email" type="email" className="input w-full" placeholder="e-mail do administrador do cliente" />
          <p className="text-[11px] text-muted2">{(await googleConfigured()) ? "O convite será enviado por e-mail (conta Salestrack)." : "Sem Gmail: o link do convite aparece na Central de Onboarding para você copiar."} A senha é definida pelo próprio usuário.</p>
        </div>

        <div className="flex gap-3">
          <button className="btn-gold">Provisionar tenant</button>
          <Link href="/admin/onboarding" className="btn-ghost">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
