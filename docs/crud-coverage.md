# Matriz de cobertura de CRUD (R2.3)

Inventário derivado do código. Classificação: **full-crud** (criar/editar/duplicar/excluir) · **read-only** (por natureza) · **system** (interno). "Quem" = quem gerencia.

## Admin

| Entidade | Tabela | Classe | Quem | CRUD hoje | Soft delete | Tela |
|---|---|---|---|---|---|---|
| Ofertas (catálogo comercial) | `catalog_items` | full-crud | admin | ✅ **kit v5 (undo)** | ✅ | `/admin/ofertas` (kit) + `/admin/catalogo` (detalhado) |
| Sinais de prospecção | `signal_definitions` | full-crud | admin | ✅ **kit v5 (undo)** | ✅ | `/admin/sinais` |
| Programas | `projects` | full-crud | admin | ✅ **kit v5 (undo, cascata)** | ✅ | `/admin/programas` (+ editor) |
| Entregáveis do programa | `deliverables` | full-crud | admin | ✅ (editor do programa) | ✅ | `/admin/programas/[id]/editar` |
| Receitas do Playbook | `playbook_recipes` | full-crud | admin | ✅ (existente) | ✅ col. | `/admin/estudio` |
| Trilhas | `playbook_trilhas` | full-crud | admin | ✅ (existente) | ✅ col. | `/admin/estudio` |
| Catálogo de sessões | `session_catalog` | full-crud | admin | ✅ (existente) | ✅ col. | `/admin/estudio` |
| Cadências | `cadences` | full-crud | admin | ✅ (existente) | ✅ col. | `/admin/prospeccao/cadencias` |
| Contas de prospecção | `prospect_accounts` | full-crud | admin | ✅ (existente) | — | `/admin/prospeccao` |
| Prospects | `prospects` | full-crud | admin | ✅ (existente) | — | `/admin/prospeccao/[id]` |
| Verticais/blocos de template | `template_verticals`/`template_blocks` | full-crud | admin | ✅ (existente) | ✅ col. | `/admin/biblioteca-templates` |
| Templates de entregável | `deliverable_templates` | full-crud | admin | ⚠️ seed-only (sem UI) | — | — *(ver "deixados de fora")* |
| Prompts de agente | `agent_prompts` | full-crud | admin | ✅ (existente) | — | `/admin/estudio` |
| Preços de modelo | `model_prices` | full-crud | admin | ✅ edição | — | `/admin/operacoes` |
| Configurações/segredos | `app_settings`/`integration_secrets` | full-crud | admin | ✅ (console) | — | `/admin/configuracoes/parametros` |
| CRM: deals/contas/contatos | `deals`/`organizations`/`contacts` | full-crud | admin | ✅ (existente) | — | `/admin/crm` |
| Tarefas | `tasks` | full-crud | admin | ✅ (existente) | — | `/admin/tarefas` |
| Propostas | `proposals` | full-crud | admin | ✅ (existente) | — | `/admin/propostas` |
| Contratos | `contracts` | full-crud | admin | ✅ (existente) | — | `/admin/contratos` |
| Planos (Fase 6) | `plans` | full-crud | admin | ✅ (existente, **arquivado**) | — | `/admin/monetizacao` *(fora da nav — modelo sem mensalidade)* |
| — | | | | | | |
| **Auditoria** | `audit_logs` | **read-only** | admin | — (imutável, hash encadeado) | — | `/admin/configuracoes/auditoria` |
| **FinOps / custo IA** | `ai_cost_daily`/`usage_events` | **read-only** | admin | — | — | `/admin/operacoes` |
| **Saúde de tenant** | `tenant_health` | **read-only** (system) | admin | — (job) | — | `/admin/operacoes` |
| **Alertas** | `alerts` | **read-only** (ack/resolve) | admin | ack/resolver apenas | — | `/admin/operacoes` |
| **ROI** | `roi_reports` | **read-only** (gerar/publicar) | admin | gerar/publicar | — | `/admin/roi` |
| **Timeline de prospecção** | `timeline_events` | **read-only** | admin | ingest. | — | `/admin/prospeccao/[id]` |

## Portal (escopo do cliente, isolado por org)

| Entidade | Tabela | Classe | Quem | CRUD hoje | Tela |
|---|---|---|---|---|---|
| Equipe da org | `invites`/`memberships` | full-crud (escopo org) | cliente (client_admin) | ✅ convidar/remover/reenviar | `/portal/equipe` |
| Meu Stack de IA | `ai_stack_entries` | full-crud (escopo org) | cliente | ✅ add/editar/remover | `/portal/stack` |
| Política de governança | `governance_policies` | full-crud (escopo org) | cliente | ✅ editar/publicar | `/portal/governanca` |
| Progresso de guia | `onboarding_progress` | full-crud (próprio usuário) | cliente | ✅ marca/dispensa | Hoje/Jornada |
| **ROI / Entregáveis / Sessões / Biblioteca** | — | **read-only** | cliente | — (consome a entrega) | `/portal/*` |

## Deixados de fora intencionalmente
- **`deliverable_templates`** (templates do Estúdio de Entregáveis): hoje é seed-only, sem tela de gestão. Baixa frequência de edição; **agendado** para receber o kit numa próxima varredura (a coluna `deleted_at` e o padrão já estão prontos). Não bloqueia o uso (os 7 templates fundadores cobrem os casos atuais).
- **Telas legadas com CRUD funcional** (catálogo detalhado, estúdio, cadências, CRM, biblioteca-templates): **já têm** criar/editar/excluir e continuam operando. A migração para o kit v5 (undo unificado) é **incremental e aditiva** — não foram reescritas agora para não arriscar regressão; a coluna `deleted_at` já foi adicionada em lote (migração 020) para habilitar o undo quando forem elevadas.

## Regra de segurança confirmada
Telas **read-only/system** (auditoria, FinOps, saúde, alertas) **não** ganharam ações destrutivas. Toda escrita full-crud passa por permissão no servidor + `lib/audit.ts` + RLS por org.
