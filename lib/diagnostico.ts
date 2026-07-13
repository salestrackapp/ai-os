import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export type CampoTipo = "text" | "textarea";
export type Campo = { id: string; label: string; tipo: CampoTipo; placeholder?: string; help?: string };
export type Secao = { titulo: string; descricao?: string; campos: Campo[] };

/** Estrutura do formulário de diagnóstico (o cliente preenche os materiais da Cláusula 6ª). Sem senhas/credenciais. */
export const DIAGNOSTICO_SECOES: Secao[] = [
  {
    titulo: "Unidades & horários",
    descricao: "Onde vocês atendem e em que horários — o agente usa isso para responder e agendar.",
    campos: [
      { id: "unidades", label: "Unidades (nome, endereço e horários de cada uma)", tipo: "textarea", placeholder: "Unidade Centro — Rua …, 000 — Seg a Sex 7h–19h, Sáb 8h–12h" },
      { id: "responsavel_operacao", label: "Responsável pela operação (interlocutor)", tipo: "text", placeholder: "Nome e cargo" },
      { id: "contato_operacao", label: "Contato do responsável (e-mail / telefone)", tipo: "text" },
    ],
  },
  {
    titulo: "Exames, preços e convênios",
    descricao: "Tabela que o agente usará para informar valores e preparos.",
    campos: [
      { id: "tabela_exames", label: "Lista de exames com preços (particular)", tipo: "textarea", placeholder: "Ultrassom abdome total — R$ …; Raio-X tórax — R$ …" },
      { id: "preparos", label: "Preparos por exame (jejum, bexiga cheia, etc.)", tipo: "textarea" },
      { id: "convenios", label: "Convênios aceitos", tipo: "textarea", placeholder: "Unimed, Bradesco Saúde, …" },
      { id: "formas_pagamento", label: "Formas de pagamento (particular)", tipo: "text", placeholder: "Pix, cartão, parcelamento…" },
    ],
  },
  {
    titulo: "Atendimento & dúvidas frequentes",
    campos: [
      { id: "faq", label: "Perguntas frequentes e respostas", tipo: "textarea", placeholder: "“Precisa de pedido médico?” — Sim, …" },
      { id: "diferenciais", label: "Diferenciais da clínica", tipo: "textarea", placeholder: "Laudo em 24h, equipamentos, corpo clínico…" },
      { id: "objecoes", label: "Dúvidas/objeções comuns dos pacientes", tipo: "textarea" },
    ],
  },
  {
    titulo: "Agendamento",
    campos: [
      { id: "como_agenda_hoje", label: "Como o agendamento funciona hoje", tipo: "textarea", placeholder: "Telefone, WhatsApp manual, recepção…" },
      { id: "regras_agenda", label: "Regras de agenda (intervalos, exames por horário, restrições)", tipo: "textarea" },
    ],
  },
  {
    titulo: "Canais atuais",
    descricao: "Para conectarmos e consolidarmos sua presença digital.",
    campos: [
      { id: "whatsapp_numero", label: "Número de WhatsApp do atendimento", tipo: "text" },
      { id: "instagram", label: "Instagram (@)", tipo: "text" },
      { id: "site_atual", label: "Site atual (se houver)", tipo: "text" },
      { id: "google_perfil", label: "Perfil no Google (Google Meu Negócio)", tipo: "text" },
      { id: "outras_redes", label: "Outras redes / canais", tipo: "textarea" },
    ],
  },
  {
    titulo: "Marca & objetivos",
    campos: [
      { id: "sobre_empresa", label: "Sobre a empresa (breve)", tipo: "textarea" },
      { id: "objetivos", label: "Principais objetivos com o projeto", tipo: "textarea", placeholder: "Reduzir no-show, mais agendamentos, atendimento 24h…" },
      { id: "observacoes", label: "Observações finais", tipo: "textarea" },
    ],
  },
];

export const DIAGNOSTICO_CAMPOS: Campo[] = DIAGNOSTICO_SECOES.flatMap((s) => s.campos);

export type Intake = { id: string; org_id: string; token: string; titulo: string; status: "aberto" | "enviado"; dados: Record<string, string>; submitted_at: string | null };

/** Público (via token): carrega o intake. Token é o segredo; usa service client. */
export async function getIntakeByToken(token: string): Promise<Intake | null> {
  const { data } = await createServiceClient().from("diagnostico_intake").select("*").eq("token", token).maybeSingle();
  return (data as Intake | null) ?? null;
}

/** Público: salva o preenchimento (merge). `enviar` marca como enviado. */
export async function saveIntakeByToken(token: string, dados: Record<string, string>, enviar: boolean): Promise<{ ok: boolean }> {
  const sb = createServiceClient();
  const { data: cur } = await sb.from("diagnostico_intake").select("id, dados").eq("token", token).maybeSingle();
  if (!cur) return { ok: false };
  const merged = { ...(cur.dados ?? {}), ...dados };
  await sb.from("diagnostico_intake").update({
    dados: merged, updated_at: new Date().toISOString(),
    ...(enviar ? { status: "enviado", submitted_at: new Date().toISOString() } : {}),
  }).eq("id", cur.id);
  return { ok: true };
}

/** Admin: intake do cliente (cria se não existir). Gera o link público. */
export async function getOrCreateIntakeForOrg(orgId: string, titulo = "Diagnóstico Digital"): Promise<Intake> {
  const sb = createServiceClient();
  const { data } = await sb.from("diagnostico_intake").select("*").eq("org_id", orgId).maybeSingle();
  if (data) return data as Intake;
  const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.round(Math.random() * 1e9)}`).replace(/-/g, "");
  const { data: ins } = await sb.from("diagnostico_intake").insert({ org_id: orgId, token, titulo }).select("*").single();
  return ins as Intake;
}
