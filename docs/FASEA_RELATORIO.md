# Fase A · Console de Configurações — Relatório

**Objetivo:** centralizar toda a configuração da plataforma num store no app, com precedência
**app_settings → env → default**, secrets write-only/mascarados/server-only, um Console em
`/admin/configuracoes/parametros`, atalhos "Configurar" em cada módulo, e módulos lendo do store.

## Entregue

### Bloco 1-2 · Fundação (store + secrets)
- **Migration 016** — `app_settings` estendida (`scope`, `org_id`, `category`, `updated_by`);
  nova `integration_secrets` (admin-only via RLS, `secret` nunca exposto ao client).
- `lib/settings/registry.ts` — fonte de verdade: 9 categorias, `SETTINGS` (modelo do consultor,
  usd_brl, alert_cost_pct, score_min_icp1/2/3, invite_expire_days, sessões, oferta comercial…),
  `SECRET_PROVIDERS` (8: anthropic/apollo/google/readai/mailerlite/zapi/slack/stripe) com texto de
  degradação por provedor.
- `lib/settings/resolve.ts` — `getSetting`/`getSettingSource`/`setSettingValue`. Org-scoped
  namespaceado como `${key}#org:${orgId}` (preserva o `unique(key)` existente, zero risco aos
  settings globais). Precedência app → env → default.
- `lib/settings/secrets.ts` — `getSecretStatuses` (status, nunca o valor), `getSecret` (runtime:
  app → env), `setSecret` (write-only, auditado sem o valor), `testConnection` (valida Anthropic/
  Apollo/Google de verdade; presença para os demais).

### Bloco 3 · Console `/admin/configuracoes/parametros`
- Navegação por categoria à esquerda; à direita, um form por setting mostrando **valor efetivo +
  badge de fonte** (`app`/`env`/`default`), por tipo (number/bool/json/string).
- Aba **Integrações**: campo mascarado write-only + botão **Testar conexão** + status por provedor.
  O valor salvo nunca é exibido de volta.
- Card de entrada em `/admin/configuracoes` → "Abrir console".

### Bloco 4 · Atalhos contextuais
- `components/config/ConfigLink.tsx` (⚙ Configurar) nos módulos: Operações→`finops`,
  Prospecção→`prospeccao`, Consultor→`ia`, Monetização→`planos`.

### Bloco 5 · Módulos lendo do store (com fallback env)
- **Consultor (Fase 5):** `lib/agents/runner.ts` resolve o modelo por `getSetting('anthropic_model_chat')`
  a cada chamada. Trocar o modelo no Console passa a valer sem redeploy.
- **FinOps:** `usdBrlLive()` (novo) lido por Operações, `lib/ops/health.ts` e `lib/ops/alerts.ts` —
  câmbio USD/BRL ao vivo. `alert_cost_pct` também via store.
- **Prospecção:** `scoreMinForLive`/`canEnrollLive` — o gate de cadência usa os mínimos por ICP do
  store (regra de ouro do funil configurável).

## Segurança
- `app_settings` e `integration_secrets`: RLS **admin-only**; cliente e anônimo não leem nem gravam.
- Segredos **write-only** na UI, cifrados no servidor, nunca retornados ao client. Auditados sem o valor.
- Nada de novo se conecta a sistemas do cliente. `connector_tokens`/`claude_workspaces` intocadas.

## Gates
- **RLS:** `npm run test:rls` → **56/56** (novos: escrita bloqueada em app_settings; leitura/escrita
  bloqueadas em integration_secrets p/ cliente e anônimo).
- **Build:** `next build` OK. Rota `/admin/configuracoes/parametros` compilada.
- **Deploy:** produção OK (`ai-os-sable.vercel.app`), rota admin-gated (307 → login).

## Pendências conhecidas
- Settings org-scoped existem no store mas o Console hoje edita o escopo global; UI de override por
  tenant fica para quando houver demanda.
- `anthropic_model_reasoning` registrado mas ainda não consumido (só o de chat é lido em runtime).
