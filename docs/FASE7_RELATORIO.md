# AI OS · Fase 7 — Observabilidade & FinOps · Relatório de Aceite

**Status:** ✅ em produção · `next build` verde · **45/45** testes RLS
**Deploy:** https://ai-os-sable.vercel.app · **/admin/operacoes**

## Fronteira
Camada 100% **operacional interna da Salestrack**, **admin-only** (RLS), calculada só com dados do AI OS. `connector_tokens`/`claude_workspaces` intocadas e não expostas.

## Critérios de aceite
| # | Critério | Status |
|---|---|---|
| 1 | Fronteira preservada (admin-only, só dados do AI OS) | ✅ |
| 2 | Isolamento (nenhuma org-cliente vê FinOps/saúde/custo/alertas) | ✅ RLS testado |
| 3 | Custo real (agent_messages × model_prices; modelo sem preço = "não configurado") | ✅ |
| 4 | Margem real (MRR − custo de IA por tenant) | ✅ na tela |
| 5 | Alerta real (dispara por threshold, resolve) | ✅ (fatura vencida / custo / churn alto) |
| 6 | Degradação graciosa (sem model_prices/Slack: build passa; custo "não configurado"; alertas no admin) | ✅ |
| 7 | RLS gate 100% | ✅ **45/45** |

## O que foi construído
- **Migration 013** (renumerada de 010): `model_prices`, `usage_events`, `ai_cost_daily`, `tenant_health`, `alerts` — todas **admin-only**.
- **FinOps** (`lib/finops/cost.ts`): custo a partir de `messages.tokens` (telemetria da Fase 5) × `model_prices` do modelo ativo. **Nota honesta:** a telemetria guarda tokens **totais** (sem split in/out nem model por msg), então o custo assume 70% entrada / 30% saída (documentado no código) e o modelo é o `ANTHROPIC_MODEL` ativo. Rollup idempotente em `ai_cost_daily` por org/agente/modelo. Modelo sem preço → custo 0 + a tela marca "não configurado".
- **Saúde & Churn** (`lib/ops/health.ts`): `engagement_score` (logins no portal + receitas concluídas + sessões + conversas, 0–100), `mrr` da assinatura, `ai_cost_usd`, `margin_usd` = MRR(USD via `USD_BRL`) − custo. Regra de churn documentada: engajamento <30 **+** (fatura vencida **ou** renovação <30d) → **alto**; <50 → médio; senão baixo.
- **Alertas** (`lib/ops/alerts.ts`): `fatura_vencida`, `custo_ia` (custo > 50% da mensalidade), `churn_alto`. Dedup por (kind, org, dia). Crítico + `SLACK_OPS_CHANNEL` → também ao Slack.
- **Cron** `/api/cron/ops` (Vercel Cron diário 06h UTC, `CRON_SECRET`): roda rollup + saúde + alertas. Botão **"Rodar jobs agora"** no admin para disparo manual.
- **Centro de Operações** `/admin/operacoes`: consolidado MRR × Custo × Margem × Alertas; status de Integrações & Jobs; margem por cliente (engajamento/MRR/custo/margem/churn); custo por agente; editor de preços de modelo; fila de alertas (reconhecer/resolver).
- **Seeds:** `model_prices` (sonnet-5, opus-4-8, haiku — preços placeholder, ajustáveis na tela).

## Verificado ao vivo
Na sessão admin: página renderiza, "Rodar jobs agora" executa, status de integrações correto (🟢 Anthropic/Google/Apollo/Preços · ⚪ Stripe/Slack/Cron/USD-BRL), tabelas de margem/custo/alertas presentes. Valores em R$0/US$0 refletem o estado real atual (nenhuma assinatura atribuída ainda + uso de IA de teste já limpo) — populam conforme houver assinatura (Fase 6) e conversas do Consultor.

## Para ativar plenamente
- **`USD_BRL`** → custo/margem em BRL.
- **`CRON_SECRET`** → jobs automáticos diários (hoje via botão).
- **`SLACK_OPS_CHANNEL`** (+ SLACK_BOT_TOKEN) → alertas críticos no Slack.
- Ajustar os **preços de modelo** reais na tela e **atribuir planos** (Fase 6) para a margem aparecer.
