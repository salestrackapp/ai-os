import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { googleConfigured } from "@/lib/google";
import { zapiConfigured } from "@/lib/whatsapp";
import { diaUtil } from "./cadence";
import type { CadenceStep } from "./types";

/**
 * O que a cadência vai fazer com esta pessoa, antes de começar a fazer.
 *
 * ── Por que existe ────────────────────────────────────────────────────────────────────────────
 * Inscrever é um salto no escuro: o botão diz "Inscrever na cadência" e o que acontece depois só se
 * descobre quando já está acontecendo. Uma cadência tem sete passos ao longo de doze dias, e alguns
 * deles caem em canais que podem nem estar ligados — o passo de WhatsApp do dia 6 vira tarefa
 * manual silenciosa se a Z-API não estiver configurada, ou se a pessoa não tiver telefone.
 *
 * Esta função não escreve nada. Ela só responde, passo a passo: em que dia, por qual canal, e o que
 * de fato vai sair — para a decisão de inscrever ser tomada com a resposta na tela.
 *
 * ── Nada aqui envia ───────────────────────────────────────────────────────────────────────────
 * Nem depois de inscrever. Todo toque de e-mail e WhatsApp nasce como RASCUNHO e para na fila de
 * aprovação. A simulação existe para mostrar o calendário, não para prometer que ele roda sozinho.
 */

export type PassoSimulado = {
  dia: number;
  quando: string;
  canal: string;
  /** O que o passo pretende — a diretriz que o redator vai receber. */
  diretriz: string;
  /** O que ACONTECE de fato, dado o estado atual dos canais e do prospect. */
  desfecho: "rascunho_para_aprovar" | "tarefa_sua" | "tarefa_por_falta";
  explicacao: string;
};

export type Simulacao = {
  cadencia: string;
  prospect: string;
  passos: PassoSimulado[];
  /** Quantos passos, na prática, viram trabalho manual seu em vez de rascunho pronto. */
  manuais: number;
};

const ROTULO_CANAL: Record<string, string> = {
  email: "E-mail", whatsapp: "WhatsApp", linkedin: "LinkedIn", ligacao: "Ligação",
};

export async function simularCadencia(prospectId: string, cadenceId: string): Promise<Simulacao | null> {
  const sb = createServiceClient();
  const [{ data: p }, { data: cad }, gmailOn, waOn] = await Promise.all([
    sb.from("prospects").select("name, email, phone").eq("id", prospectId).maybeSingle(),
    sb.from("cadences").select("name, steps").eq("id", cadenceId).maybeSingle(),
    googleConfigured(),
    zapiConfigured(),
  ]);
  if (!p || !cad) return null;

  const steps = (Array.isArray(cad.steps) ? cad.steps : []) as CadenceStep[];
  const hoje = new Date();

  const passos: PassoSimulado[] = steps.map((s) => {
    const dia = s.dia ?? 0;
    // Mesmo deslocamento de fim de semana que o motor aplica — a prévia tem de mostrar a data real.
    const data = diaUtil(new Date(hoje.getTime() + dia * 86400000));
    const base = {
      dia,
      quando: data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" }),
      canal: ROTULO_CANAL[s.canal] ?? s.canal,
      diretriz: s.modelo ?? "—",
    };

    // LinkedIn e ligação nunca foram automáticos — são trabalho seu por desenho, não por falta.
    if (s.tipo !== "toque" || (s.canal !== "email" && s.canal !== "whatsapp")) {
      return { ...base, desfecho: "tarefa_sua" as const, explicacao: "Entra na sua fila como tarefa. Sempre foi assim — o canal não é automatizável." };
    }

    if (s.canal === "email") {
      if (!p.email) return { ...base, desfecho: "tarefa_por_falta" as const, explicacao: "Este prospect não tem e-mail. O rascunho é escrito, mas não há para onde mandar." };
      if (!gmailOn) return { ...base, desfecho: "tarefa_por_falta" as const, explicacao: "O Gmail não está conectado. O rascunho fica pronto e o envio é seu, por fora." };
      return { ...base, desfecho: "rascunho_para_aprovar" as const, explicacao: "A IA escreve e o rascunho espera na fila. Sai quando você aprovar." };
    }

    if (!p.phone) return { ...base, desfecho: "tarefa_por_falta" as const, explicacao: "Este prospect não tem telefone. O passo passa em branco." };
    if (!waOn) return { ...base, desfecho: "tarefa_por_falta" as const, explicacao: "A Z-API não está configurada. O rascunho fica pronto e o envio é seu, por fora." };
    return { ...base, desfecho: "rascunho_para_aprovar" as const, explicacao: "A IA escreve e o rascunho espera na fila. Sai quando você aprovar." };
  });

  return {
    cadencia: cad.name as string,
    prospect: (p.name as string) ?? "—",
    passos,
    manuais: passos.filter((x) => x.desfecho !== "rascunho_para_aprovar").length,
  };
}
