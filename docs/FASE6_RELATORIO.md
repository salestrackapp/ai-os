# AI OS · Fase 6 — Monetizar · Relatório de Aceite

**Status:** ✅ em produção · `next build` verde · **42/42** testes RLS
**Deploy:** https://ai-os-sable.vercel.app
**Modo atual:** Stripe em **modo manual** (sem `STRIPE_SECRET_KEY`) — assinaturas e faturas geridas pelo admin; tudo funciona.

## Fronteira de arquitetura (confirmada)
Stripe = cobrança **da Salestrack**. "Meu Stack de IA" (C3) é **registro declarativo** — nada conecta a sistema do cliente. `connector_tokens`/`claude_workspaces` intocadas e não expostas.

## Critérios de aceite
| # | Critério | Status |
|---|---|---|
| 1 | Fronteira preservada (Stripe = cobrança Salestrack; C3 declarativo; legado intocado) | ✅ |
| 2 | Feature-gating por org (plano da assinatura ativa, default seguro Base) | ✅ testado (2 orgs) |
| 3 | White-label isolado (tema N2 não vaza nem altera design global) | ✅ (override escopado `.wl-theme` por render de tenant) |
| 4 | Degradação graciosa (sem envs Stripe: build passa; assinatura/fatura manual; branding e segurança funcionam) | ✅ |
| 5 | Auditoria (assinatura, plano, pagamento, tema, publicação) | ✅ via `lib/audit.ts` |
| 6 | RLS gate 100% | ✅ **42/42** |
| 7 | Uso real (piloto em plano real + fatura + N2 + página de Segurança) | 🟡 pronto para executar no admin (ver abaixo) |

## O que foi construído
- **Migration 012** (renumerada de 009): `plans` (novo), `subscriptions` estendida (+plan_key, monthly_platform_fee, current_period_end, updated_at), `tenant_branding` +custom_domain, `ai_stack_entries` (C3) e `governance_policies` (novos). RLS: planos leitura autenticada/escrita admin; stack e governança isolados por org.
- **Bloco 2 · Billing** (`lib/billing/stripe.ts`): `hasBilling()` + criação de customer/subscription no Stripe (REST) quando há chave; **modo manual** por padrão. Portal C10 Financeiro segue read-only.
- **Bloco 3 · Feature-gating** (`lib/plans/features.ts` `orgHasFeature`/`getOrgFeatures`, default Base seguro): aplicado em `/portal/playbook`, `/consultor`, `/sessoes`, `/roi` — recurso fora do plano mostra **upsell elegante** (`components/portal/Upsell`), nunca erro. Prospecção/agentes internos **não** são gated (são da Salestrack).
- **Bloco 4 · White-label:** N1 (logo do tenant, já existia); **N2** aplica cor/logo/nome do tenant como override CSS **escopado ao subtree do portal** (isolado, só quando o plano libera `whitelabel_n2`); N3 tem o campo `custom_domain` + edição no admin (roteamento por host = próximo passo — sem domínio, cai em N2/N1, como previsto).
- **Bloco 5 · Governança como produto:** `/portal/stack` (C3 declarativo — quais IAs, para quê, o que cada uma pode receber, classificação de dados); `/portal/governanca` (edita política + **rascunho por IA** a partir do stack + publicar); **página pública** `/seguranca/[public_token]` (fora do guard, respeita white-label) — o documento que o comitê de risco do cliente lê.
- **Bloco 6 · Central de Monetização** `/admin/monetizacao`: editar planos (preço, stripe_price_id, features), atribuir plano + mensalidade por cliente, white-label por tenant, publicar página de Segurança, **MRR** e distribuição por plano.
- **Bloco 7 · Proposta → assinatura:** botão na proposta aprovada cria a assinatura pré-preenchida (plano Pro + `monthly_platform_fee` da proposta). Auditado.
- **Bloco 8 · Seeds:** 3 planos (Base/Pro/Enterprise) com `features` calibráveis.

## Roteiro do "uso real" (critério 7 — pronto para você executar)
1. Admin → **Monetização** → no cliente piloto (ART MG ou Imago): escolha **Professional**, defina a mensalidade "Plataforma AI OS", status **ativa** → *Aplicar plano*.
2. **Financeiro** → registre a fatura da mensalidade e marque paga (modo manual) — ou, com `STRIPE_SECRET_KEY`, a fatura sincroniza pelo webhook.
3. Em Monetização → white-label do cliente: nível **N2**, cor de acento + logo → *Salvar tema*. O portal daquele cliente passa a exibir a marca dele.
4. O cliente (ou você na visão admin) edita a política em **Governança** → *Publicar* → a página `/seguranca/<token>` fica pública com a identidade do tenant.

## Pendências / próximo passo
- **`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*`** para faturamento automático (hoje manual). Envs documentadas em `.env.example`.
- **N3 (domínio próprio):** campo e DNS prontos; falta o roteamento por host no middleware (resolver org pelo domínio) — próxima leva.
