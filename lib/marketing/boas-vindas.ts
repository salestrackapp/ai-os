import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { linkDescadastro, linkDescadastroUmClique } from "@/lib/lgpd/consentimento";
import { renderEmail, renderTexto, type Bloco } from "./blocos";
import { templatePorSlug } from "./templates";

/**
 * O e-mail de boas-vindas, disparado no instante da confirmação.
 *
 * ── Por que na hora, e não na próxima edição ──────────────────────────────────────────────────
 * Quem acabou de clicar em "confirmar" está com a atenção na gente AGORA. Esperar até a próxima
 * newsletter significa reaparecer na caixa de alguém até duas semanas depois, quando ele já não
 * lembra de ter se inscrito — e mensagem que a pessoa não reconhece é candidata a "isto é spam".
 * O primeiro e-mail existe tanto para dar valor quanto para fixar quem está falando.
 *
 * ── Editável sem passar por aqui ──────────────────────────────────────────────────────────────
 * Se existir uma campanha com o modelo `boas-vindas` APROVADA no estúdio, é ela que sai. Assim o
 * texto é ajustado na mesma tela das outras campanhas, com prévia e teste, sem depender de deploy.
 * Sem nenhuma aprovada, cai no modelo embutido — o fluxo funciona no primeiro dia, antes de alguém
 * ter montado qualquer coisa.
 */

const SLUG = "boas-vindas";
const REMETENTE_PADRAO = process.env.EMAIL_MARKETING_FROM ?? "Salestrack AI <aios@salestrack.com.br>";

type Fonte = { assunto: string; preheader: string | null; blocos: Bloco[]; remetente: string; campanhaId: string | null };

async function escolherFonte(): Promise<Fonte> {
  const sb = createServiceClient();
  const { data: c } = await sb.from("email_campanhas")
    .select("id, assunto, preheader, blocos, remetente")
    .eq("template_slug", SLUG).eq("status", "aprovada").is("deleted_at", null)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (c && Array.isArray(c.blocos) && c.blocos.length) {
    return {
      assunto: c.assunto as string, preheader: (c.preheader as string) ?? null,
      blocos: c.blocos as Bloco[], remetente: (c.remetente as string) ?? REMETENTE_PADRAO,
      campanhaId: c.id as string,
    };
  }

  const t = templatePorSlug(SLUG)!;
  return { assunto: t.assunto, preheader: t.preheader, blocos: t.blocos, remetente: REMETENTE_PADRAO, campanhaId: null };
}

/**
 * Manda o boas-vindas. NUNCA lança.
 *
 * Uma falha aqui não pode derrubar a confirmação: a pessoa já clicou, o consentimento já foi
 * gravado e ela já está na lista. Ficar sem o primeiro e-mail é um problema; ver "erro" numa tela
 * que deveria dizer "pronto" é pior — ela tentaria de novo, e a segunda tentativa cai em
 * "já confirmado", que parece que nada funcionou.
 */
export async function enviarBoasVindas(email: string, nome: string | null): Promise<{ enviado: boolean; motivo?: string }> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return { enviado: false, motivo: "Resend não configurado." };

  try {
    const sb = createServiceClient();
    const alvo = email.trim().toLowerCase();

    // Endereço suprimido (bounce duro, reclamação) não recebe nem boas-vindas.
    const { data: bloqueado } = await sb.from("email_supressao").select("email").eq("email", alvo).maybeSingle();
    if (bloqueado) return { enviado: false, motivo: "Endereço suprimido." };

    const fonte = await escolherFonte();

    /**
     * Quando vem de uma campanha, o envio é REGISTRADO nela — e a chave única (campanha, e-mail)
     * é o que garante um boas-vindas por pessoa, mesmo que alguém confirme duas vezes por caminhos
     * diferentes. De quebra, a campanha vira um painel vivo: quantos boas-vindas saíram e quantos
     * foram abertos, sem virar "enviada" (segue editável, porque é recorrente).
     */
    if (fonte.campanhaId) {
      const { error } = await sb.from("email_envios").insert({
        campanha_id: fonte.campanhaId, email: alvo, nome, status: "pendente",
      });
      if (error) return { enviado: false, motivo: "Boas-vindas já enviado para este endereço." };
    }

    const primeiro = (nome ?? "").trim().split(/\s+/)[0] || null;
    const [saida, saidaUmClique] = await Promise.all([linkDescadastro(alvo), linkDescadastroUmClique(alvo)]);
    const base = {
      assunto: fonte.assunto, preheader: fonte.preheader, blocos: fonte.blocos,
      remetente: fonte.remetente, unsubscribeUrl: saida, endereco: alvo,
      dados: { nome: primeiro, nome_completo: nome, empresa: null },
    };
    const assunto = fonte.assunto.replace(/\{\{\s*(\w+)\s*(?:\|\s*([^}]*?))?\s*\}\}/g,
      (_m, k: string, padrao?: string) => (k === "nome" ? primeiro : null) || (padrao ?? "").trim() || "");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fonte.remetente, to: [alvo], subject: assunto,
        html: renderEmail(base), text: renderTexto(base),
        ...(saidaUmClique ? {
          headers: { "List-Unsubscribe": `<${saidaUmClique}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        } : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));

    if (fonte.campanhaId) {
      await sb.from("email_envios").update({
        status: res.ok ? "enviado" : "falhou",
        provider_ref: json?.id ?? null, erro: res.ok ? null : `Resend ${res.status}`,
        enviado_em: res.ok ? new Date().toISOString() : null,
      }).eq("campanha_id", fonte.campanhaId).eq("email", alvo);
    }

    await auditService("newsletter.boas_vindas", "email_campanhas", fonte.campanhaId ?? undefined,
      { email: alvo, ok: res.ok, do_estudio: !!fonte.campanhaId });
    return res.ok ? { enviado: true } : { enviado: false, motivo: `Resend ${res.status}` };
  } catch (e) {
    console.error("[boas-vindas] falhou:", (e as Error).message);
    return { enviado: false, motivo: (e as Error).message };
  }
}
