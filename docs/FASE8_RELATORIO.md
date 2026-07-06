# AI OS · Fase 8 — Onboarding Self-Service de Tenant · Relatório de Aceite

**Status:** ✅ em produção · `next build` verde · **49/49** testes RLS · **provisionamento real validado ao vivo**
**Deploy:** https://ai-os-sable.vercel.app · **/admin/onboarding**

## Fronteira
Provisiona tenants **dentro do AI OS**; convite sai pela conta Salestrack (Gmail). Nada conecta a sistema de cliente. `connector_tokens`/`claude_workspaces` intocadas.

## Critérios de aceite
| # | Critério | Status |
|---|---|---|
| 1 | Zero banco manual (org, marca, assinatura, programa, convite, checklist pelo wizard) | ✅ |
| 2 | Isolamento (tenant nasce isolado; passo "isolamento" confere) | ✅ RLS testado |
| 3 | Idempotência & resiliência (re-executar não duplica; falha não deixa meio-tenant; **retomar**) | ✅ |
| 4 | Convite seguro (aceite cria conta no Supabase Auth, senha do usuário; token expira/revogável) | ✅ (reusa `invites` + /convite/[token] da Fase 4a) |
| 5 | Degradação graciosa (sem Gmail → link copiável; sem template → programa mínimo; build passa) | ✅ |
| 6 | Auditoria (provisionamento, convite, aceite, retomada, reversão) | ✅ |
| 7 | RLS gate 100% | ✅ **49/49** |
| 8 | Uso real (tenant real provisionado do template ART MG) | ✅ **validado ao vivo** |

### Prova do critério 8 (ao vivo)
Wizard → "Piloto ART MG DEMO" com template **ART MG · 12 meses**, plano Professional. Resultado no banco: org criada (onboarding), **8 entregáveis**, projeto do programa, **checklist de 5 itens**, assinatura `pro`, branding N1, `tenant_provisioning.status = pronto` com os 7 passos executados (org, branding, assinatura, programa, convite, checklist, isolamento).

## O que foi construído
- **Migration 014** (renumerada de 011): `program_templates`, `tenant_provisioning` (+`input` jsonb p/ retomar), `onboarding_checklists` — admin-only; checklist org-scoped. **Reusa `invites`** (Fase 4a) em vez de criar `invitations` (não duplica o aceite).
- **Motor** `lib/provisioning/provision.ts`: 7 passos idempotentes (dedup por slug/título), resumível (grava `steps`, marca `falhou`, retoma pelo `input` salvo), com verificação de isolamento; toda a execução auditada. Convite via Gmail (Fase 5.5) se configurado, senão link copiável.
- **Template ART MG** (Bloco 3/8): 4 frentes, 8 entregáveis, timeline trimestral, agentes por frente, biblioteca inicial.
- **Wizard** `/admin/onboarding/novo`: cliente → plano/marca → programa (template) → admin do cliente → provisionar. Aceita prefill de **deal ganho** (`?deal=`).
- **Central** `/admin/onboarding`: provisionamentos (status/passos, **retomar**/**reverter**), convites (reenviar/revogar), ativação por cliente (progresso do checklist).
- **Onboarding do cliente** (Bloco 6): card de ativação no portal (Meu Programa) com os 5 passos marcáveis (perfil, 1ª pergunta ao Consultor, revisar programa, declarar stack, convidar equipe) → ataca o churn medido na Fase 7.

## Notas honestas
- **Reversão** só remove orgs em status `onboarding` (nunca ativa) — trava de segurança.
- Achei (e limpei) um órfão em `tenant_provisioning` deixado pela limpeza do teste RLS (FK `on delete set null` ao apagar a org de teste) — cosmético, sem impacto.
- Envio do convite por Gmail já está ligado (Fase 5.5); sem Gmail seria link copiável na Central.
