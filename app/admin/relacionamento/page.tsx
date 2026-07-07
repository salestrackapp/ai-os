/** Relacionamento (E0) — casca da inbox compartilhada de equipe. Abas Caixa de entrada / Mensagens.
 * O modelo (rel_conversas/rel_mensagens) já existe; as telas de sync chegam em E1–E4. */
import { createClient } from "@/lib/supabase/server";
import { ContentArea, PageHeader, Card, EmptyState, Badge } from "@/components/ds";
import { Tabs, Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { HelpButton } from "@/components/guidance/HelpButton";

export const dynamic = "force-dynamic";

async function counts(channel: "email" | "whatsapp") {
  const sb = await createClient();
  const { count: abertas } = await sb.from("rel_conversas").select("id", { count: "exact", head: true }).eq("channel", channel).eq("status", "aberta").is("deleted_at", null);
  const { count: naoLidas } = await sb.from("rel_conversas").select("id", { count: "exact", head: true }).eq("channel", channel).eq("unread", true).is("deleted_at", null);
  return { abertas: abertas ?? 0, naoLidas: naoLidas ?? 0 };
}

export default async function Relacionamento() {
  const [email, whats] = await Promise.all([counts("email"), counts("whatsapp")]);

  const caixaEntrada = (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[180px]"><p className="ds-eyebrow">Abertas</p><p className="ds-h2">{email.abertas}</p></Card>
        <Card className="flex-1 min-w-[180px]"><p className="ds-eyebrow">Não lidas</p><p className="ds-h2">{email.naoLidas}</p></Card>
      </div>
      <Card>
        <EmptyState icon={<Icon name="chat" size={22} />} title="Sua caixa de e-mail vai aparecer aqui"
          description="Em breve (E1) sincronizamos o Gmail da Salestrack: você lê os e-mails, atribui a um membro da equipe, vincula ao cliente e responde — tudo pela plataforma."
          guiaHref="/admin/ajuda" />
      </Card>
    </div>
  );

  const mensagens = (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[180px]"><p className="ds-eyebrow">Abertas</p><p className="ds-h2">{whats.abertas}</p></Card>
        <Card className="flex-1 min-w-[180px]"><p className="ds-eyebrow">Não lidas</p><p className="ds-h2">{whats.naoLidas}</p></Card>
      </div>
      <Card>
        <EmptyState icon={<Icon name="chat" size={22} />} title="Suas conversas de WhatsApp vão aparecer aqui"
          description="Em breve (E3) o WhatsApp (Z-API) vira conversa de 2 vias: recebe, responde e envia templates (HSM) daqui, sempre com opt-in. A cadência automática continua na Comunicação."
          guiaHref="/admin/ajuda" />
      </Card>
    </div>
  );

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Relacionamento" }]} className="mb-4" />
      <PageHeader eyebrow="Relacionamento" title="Caixa da equipe"
        subtitle="A caixa de e-mail e as mensagens de WhatsApp da Salestrack, em um lugar — com atribuição por membro e vínculo ao cliente."
        comoUsar={<HelpButton routeKey="/admin/relacionamento" />}
        actions={<Badge tone="neutral">Fundação (E0) · telas em E1–E4</Badge>} />
      <Tabs defaultTab="caixa" tabs={[
        { id: "caixa", label: "Caixa de entrada", content: caixaEntrada },
        { id: "mensagens", label: "Mensagens", content: mensagens },
      ]} />
    </ContentArea>
  );
}
