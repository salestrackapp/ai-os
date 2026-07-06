# Reset pré-piloto — EXECUTADO ✅ (2026-07-06)

> **Status: concluído.** Confirmação do operador: **"Sim, limpar tudo"** (incl. ART MG + Imago) + **"Manter a trilha"** (audit_logs). Backup restaurável antes da remoção (Bloco 1). Resultado no fim do doc.

## Bloco 1 — Ponto de retorno (feito ✅)
- **Tag git** `pre-piloto-reset` → commit `d434275` (baseline v2 + logo + tour).
- **Snapshot completo do banco** no schema `piloto_backup` (82 tabelas, cópia integral dos dados). Restaurável por tabela: `truncate public.X; insert into public.X select * from piloto_backup.X;`. Remover depois do piloto estável: `drop schema piloto_backup cascade`.
- ⚠️ **Ambiente é produção** (não há staging separado; projeto Supabase `maazgvwbcszcsjsvqnnf`). A remoção só ocorre após seu "ok".

## Bloco 3 — KEEP-LIST (o molde — NÃO se remove)
| Item | Tabela(s) | Linhas |
|---|---|---|
| Org Salestrack + admin | organizations (só is_salestrack), memberships (admin) | 1 + 1 |
| **Catálogo de ofertas** | catalog_items | 36 |
| **Templates de programa** | program_templates, template_verticals, template_blocks, template_versions | 4/4/13/4 |
| **Templates de entregável** | deliverable_templates | 7 |
| **Método (Playbook/Sessões)** | playbook_recipes, playbook_trilhas, session_catalog | 20/3/8 |
| **Régua-template** | regua (scope=program_template), regua_step | 1/6 |
| **Cadências fundadoras** | cadences | 3 |
| Config / IA / FinOps | signal_definitions, agent_prompts, plans, model_prices, app_settings, integration_secrets, ai_platforms | 8/6/3/3/0/2/14 |
| Trilha de auditoria | audit_logs | 160 |
| Schema/migrations/RLS/design system/tokens | (estrutura) | intacto |

## Bloco 2 — DELETE (dados de teste/demonstração)

### Orgs de teste/demo → remover (6) + tudo dependente
| Org | Nota |
|---|---|
| `[DEMO] Cliente Exemplo · Programa de IA` | demo (4 entregáveis) |
| `Clínica Piloto Saúde DEMO` | demo blueprint saúde |
| `E2E Kickoff` | teste e2e |
| `E2E Read AI` | teste e2e |
| `IMAGO Diagnósticos` | **cliente piloto demo** (9 entregáveis, 1 proposta, 2 membros, 2 convites) |
| `Piloto ART MG DEMO` | **cliente piloto demo** |

> **Decisão do operador (Bloco 3):** os pilotos **ART MG** e **Imago** entram na remoção (default: começar do zero; serão recriados no roteiro). Confirme ou peça para preservá-los.

### Dados transacionais a limpar (contagens atuais = tudo é teste)
| Tabela | Linhas | Tabela | Linhas |
|---|---|---|---|
| prospect_accounts | 406 | prospects | 406 |
| proposal_events | 93 | tenant_provisioning | 36 |
| studio_deliverables | 14 | deliverables | 13 |
| invoices | 10 | contract_events | 9 |
| portal_access_log | 9 | subscriptions | 6 |
| projects | 6 | studio_deliverable_versions | 6 |
| tasks | 5 | contracts | 4 |
| tenant_branding | 4 | library_assets | 4 |
| session_credits | 4 | tenant_health | 4 |
| messages | 4 | proposals | 3 |
| activities | 3 | deals | 2 |
| wa_messages | 2 | invites | 2 |
| onboarding_checklists | 2 | claude_workspaces | 2 |
| memberships (cliente) | 2 | roi_reports | 2 |
| contacts | 1 | conversations | 1 |
| outreach_messages | 1 | timeline_events | 1 |
| **onboarding_progress** | 1 | *(reset → tour reabre no 1º acesso)* | |
| já vazias | comm_queue, comms_delivery, comms_consent, cadence_enrollments, cadence_step_log, sessions, recipe_progress, formacao_certificados, programa_identidade, memories, agents, usage_events, ai_cost_daily, alerts, orchestrations | 0 |

**Total a remover ≈ 900+ linhas** (a maior parte = 812 linhas de prospecção importada de teste).

## Estratégia de remoção (após confirmação)
1. Numa transação: apagar as 6 orgs não-Salestrack (cascata FK) + limpar explicitamente as tabelas de escopo Salestrack (prospecção, CRM, propostas, faturas, estúdio, etc.) que não são filhas de org de cliente.
2. `delete from onboarding_progress` (zera tour/primeiros passos de todos — reabre no próximo login).
3. Buckets de storage (entregaveis/biblioteca/contratos) — limpar objetos de teste (opcional; não afeta RLS).
4. Tudo auditado. **Nada fora deste escopo.**

## Decisões que preciso confirmar
1. **Remover ART MG + Imago?** (default: SIM)
2. **Manter `cadences` (3 fundadoras) e `regua`-template?** (default: SIM — são molde)
3. **audit_logs (160): manter ou limpar?** (default: MANTER a trilha)
4. **claude_workspaces (2): remover?** (default: SIM — legado, AI OS não integra sistemas do cliente)

> Responda com o "ok" (e ajustes, se houver) e eu executo o Bloco 4.

---

## Resultado da execução (Bloco 4–6) ✅
- **Removidas 6 orgs de teste/demo** + todo o dependente (cascata FK). audit_logs das orgs de teste apagados (84 restantes = trilha da Salestrack).
- **Estado final:** organizations=1 (Salestrack), memberships=1 (admin), e **0** em: prospects/prospect_accounts, deals, proposals, contracts, projects, studio_deliverables, deliverables, invoices, subscriptions, tenant_provisioning, tenant_branding, invites, onboarding_progress (tour resetado).
- **Keep-list intacta:** catalog_items 36 · program_templates 4 (+verticals 4/blocks 13/versions 4) · deliverable_templates 7 · playbook_recipes 20/trilhas 3/session_catalog 8 · **regua 1 + regua_step 6** · cadences 3 · signal_definitions 8 · agent_prompts 6 · plans 3 · model_prices 3 · ai_platforms 14 · integration_secrets 2 · audit_logs 84.
- **Efeito colateral tratado:** `TRUNCATE ... CASCADE` esvaziou `regua_step` (FK `asset_ref`→studio_deliverables força a tabela filha inteira, mesmo com `asset_ref` nulo). Os 6 passos-template (asset_ref nulo) foram **restaurados do backup** `piloto_backup.regua_step`.
- **Gate:** `npm run test:rls` **68/68** · `next build` OK.
- **Backup:** schema `piloto_backup` (82 tabelas) + tag git `pre-piloto-reset`. Remover após piloto estável: `drop schema piloto_backup cascade`.
