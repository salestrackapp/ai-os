import { createClient } from "@/lib/supabase/server";
import { PageHeader, ContentArea } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { ConfigNav } from "@/components/config/ConfigNav";
import { NOTIF_EVENTS } from "@/lib/notifications/events";
import { salvarPreferencias } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prefs } = await supabase.from("notification_prefs").select("event, in_app, email");
  const porEvento = new Map((prefs ?? []).map((p) => [p.event, p]));

  return (
    <ContentArea>
      <div className="max-w-2xl">
        <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Configurações", href: "/admin/configuracoes" }, { label: "Notificações" }]} className="mb-4" />
        <PageHeader eyebrow="Plataforma" title="Notificações"
          subtitle="Escolha como quer ser avisado em cada evento. Vale só para você." />
        <ConfigNav />

        <form action={salvarPreferencias} className="card p-6">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="th">Evento</th>
                <th className="th w-24 text-center">No sistema</th>
                <th className="th w-24 text-center">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {NOTIF_EVENTS.map((ev) => {
                const p = porEvento.get(ev.key);
                const inApp = p ? p.in_app : ev.defaults.inApp;
                const email = p ? p.email : ev.defaults.email;
                return (
                  <tr key={ev.key} className="border-t border-line">
                    <td className="td">
                      <span className="block text-sm">{ev.label}</span>
                      <span className="block text-[13px] text-muted2">{ev.descricao}</span>
                    </td>
                    <td className="td text-center">
                      <input type="checkbox" name={`in_app:${ev.key}`} defaultChecked={inApp} className="accent-[#007A94]"
                        aria-label={`${ev.label} — avisar no sistema`} />
                    </td>
                    <td className="td text-center">
                      <input type="checkbox" name={`email:${ev.key}`} defaultChecked={email} className="accent-[#007A94]"
                        aria-label={`${ev.label} — avisar por e-mail`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-6 flex items-center gap-3">
            <button className="btn-gold">Salvar preferências</button>
            <span className="text-[13px] text-muted2">{user?.email}</span>
          </div>
        </form>

        <p className="mt-4 text-[13px] text-muted2">
          WhatsApp ainda não é um canal aqui: o sistema não guarda telefone por usuário. Quando guardar, a coluna entra nesta mesma tabela.
        </p>
      </div>
    </ContentArea>
  );
}
