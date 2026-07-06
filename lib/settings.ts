import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/** Termos e seções configuráveis do contrato (editáveis em /admin/configuracoes/contratos). */
export type ContractSettings = {
  contratada_nome: string;
  contratada_cnpj: string;
  contratada_endereco: string;
  foro: string;
  aviso_previo_dias: number;
  creditos_validade_meses: number;
  reajuste_indice: string;                 // ex.: IPCA
  clausula_plataforma: string;
  clausula_confidencialidade: string;
  clausula_lgpd: string;
  clausula_rescisao: string;
  clausulas_extras: { titulo: string; corpo: string }[];
};

export const DEFAULT_CONTRACT_SETTINGS: ContractSettings = {
  contratada_nome: "Salestrack Inteligência Digital LTDA",
  contratada_cnpj: process.env.SALESTRACK_CNPJ ?? "[CNPJ Salestrack]",
  contratada_endereco: process.env.SALESTRACK_ENDERECO ?? "São Paulo/SP",
  foro: "São Paulo/SP",
  aviso_previo_dias: 30,
  creditos_validade_meses: 12,
  reajuste_indice: "IPCA",
  clausula_plataforma:
    "O programa opera sobre plataforma de IA corporativa contratada pelo CONTRATANTE — recomendação primária: Claude Team ou Enterprise (Anthropic). A contratação e manutenção da assinatura é condição para a experiência completa do programa.",
  clausula_confidencialidade:
    "As partes manterão sigilo sobre informações trocadas. O método, as skills, os prompts, os agentes e os materiais desenvolvidos permanecem propriedade da CONTRATADA, sendo concedida ao CONTRATANTE licença de uso durante a vigência.",
  clausula_lgpd:
    "As partes observarão a Lei nº 13.709/2018 (LGPD). Para os dados do programa, o CONTRATANTE atua como controlador e a CONTRATADA como operadora, tratando dados apenas para a execução do objeto.",
  clausula_rescisao:
    "O contrato vigora a partir da assinatura, pelo prazo do programa contratado, renovável. A rescisão imotivada por qualquer parte exige aviso prévio, sem prejuízo das parcelas de implantação já vencidas.",
  clausulas_extras: [],
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const sb = createServiceClient();
  const { data } = await sb.from("app_settings").select("value").eq("key", key).single();
  return (data?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function getContractSettings(): Promise<ContractSettings> {
  const v = await getSetting<Partial<ContractSettings>>("contract", {});
  return { ...DEFAULT_CONTRACT_SETTINGS, ...v };
}

/** Posicionamento comercial / o que a Salestrack entrega — embasa os agentes de prospecção e conteúdo.
 *  Editável em /admin/configuracoes (chave app_settings 'sales_offer'). */
export const DEFAULT_SALES_OFFER = `A Salestrack (marca pessoal André Kachan) implanta **IA em toda a empresa** — não uma ferramenta isolada, mas um método de transformação. Entregas:
- **Programa de IA** por frentes (Comercial, Marketing, Operações, Financeiro, RH, Atendimento), com evolução por fases.
- **Playbook** de Receitas prontas (o time aplica IA no dia a dia no próprio Claude) — do operacional ao C-level.
- **Sessões ao vivo**: mentorias, workshops, treinamentos e formação (AI Academy / AI Labs).
- **Consultoria executiva** de estratégia com IA para a liderança.
Posicionamento: IA aplicada ao negócio, com adoção real e ROI mensurável — o decisor no comando, o time capacitado.`;

export async function getSalesOffer(): Promise<string> {
  return getSetting<string>("sales_offer", DEFAULT_SALES_OFFER);
}
