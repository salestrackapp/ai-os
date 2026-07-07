// Registro de configurações — fonte da verdade da UI e do resolvedor. (Fase A)
export type SettingType = "string" | "number" | "bool" | "json" | "select" | "secret";
export type SettingDef = {
  key: string; label: string; category: string; type: SettingType;
  scope?: "global" | "org"; default?: unknown; env?: string; sensitive?: boolean;
  options?: { value: string; label: string }[]; help?: string;
};

export const CATEGORIES: { key: string; label: string }[] = [
  { key: "marca", label: "Marca & Identidade" },
  { key: "ia", label: "IA & Modelos" },
  { key: "finops", label: "FinOps" },
  { key: "prospeccao", label: "Prospecção" },
  { key: "planos", label: "Planos & Faturamento" },
  { key: "onboarding", label: "Onboarding" },
  { key: "sessoes", label: "Sessões ao Vivo" },
  { key: "governanca", label: "Governança & Segurança" },
  { key: "integracoes", label: "Integrações (chaves)" },
];

export const SETTINGS: SettingDef[] = [
  // Marca
  { key: "brand_accent_default", label: "Cor de acento padrão", category: "marca", type: "string", default: "#C89B3C" },
  // IA & Modelos
  { key: "anthropic_model_chat", label: "Modelo do Consultor (chat)", category: "ia", type: "string", env: "ANTHROPIC_MODEL", default: "claude-sonnet-5", help: "Usado pelos agentes da Fase 5." },
  { key: "anthropic_model_reasoning", label: "Modelo de raciocínio", category: "ia", type: "string", env: "ANTHROPIC_MODEL_REASONING", default: "claude-sonnet-5" },
  // FinOps
  { key: "usd_brl", label: "Cotação USD/BRL", category: "finops", type: "number", env: "USD_BRL", default: null, help: "Sem valor → custo/margem em USD." },
  { key: "alert_cost_pct", label: "Alerta: custo IA acima de % da mensalidade", category: "finops", type: "number", default: 0.5 },
  // Prospecção
  { key: "score_min_icp1", label: "Score mínimo ICP1", category: "prospeccao", type: "number", default: 60 },
  { key: "score_min_icp2", label: "Score mínimo ICP2", category: "prospeccao", type: "number", default: 55 },
  { key: "score_min_icp3", label: "Score mínimo ICP3", category: "prospeccao", type: "number", default: 60 },
  // Onboarding
  { key: "invite_expire_days", label: "Expiração do convite (dias)", category: "onboarding", type: "number", default: 14 },
  { key: "onboarding_default_template", label: "Template default do provisionamento", category: "onboarding", type: "string", default: "pme_generico" },
  // Sessões
  { key: "session_default_duration", label: "Duração padrão da sessão (min)", category: "sessoes", type: "number", default: 60 },
  { key: "session_reminder_hours", label: "Lembrete antes da sessão (horas)", category: "sessoes", type: "number", default: 24 },
  // Governança
  { key: "sales_offer", label: "Posicionamento comercial (oferta)", category: "governanca", type: "json", help: "Ancora os agentes de prospecção. Ver Fase 5.5." },
];

export const SECRET_PROVIDERS: { provider: string; label: string; degrada: string }[] = [
  { provider: "anthropic", label: "Anthropic (agentes)", degrada: "Consultor/ROI/Copiloto ficam indisponíveis." },
  { provider: "apollo", label: "Apollo (prospecção)", degrada: "Import cai para CSV/manual." },
  { provider: "google", label: "Google OAuth (Gmail/Calendar)", degrada: "Envio vira rascunho; timeline sem Gmail/Calendar." },
  { provider: "readai", label: "Read AI", degrada: "Sem notas de reunião na timeline." },
  { provider: "mailerlite", label: "MailerLite", degrada: "Nurture em modo manual." },
  { provider: "zapi", label: "Z-API (WhatsApp)", degrada: "Canal WhatsApp inativo." },
  { provider: "slack", label: "Slack", degrada: "Alertas críticos só no admin." },
  { provider: "asaas", label: "ASAAS (assinaturas, boleto/Pix, faturas)", degrada: "Faturamento em modo manual." },
];

export function findSetting(key: string): SettingDef | undefined { return SETTINGS.find((s) => s.key === key); }
