# AI OS · Fase 9 — Biblioteca de Templates Multi-Vertical · Relatório de Aceite

**Status:** ✅ em produção · `next build` verde · **52/52** testes RLS · **provisionamento setorial validado ao vivo**
**Deploy:** https://ai-os-sable.vercel.app · **/admin/biblioteca-templates**

## Compatibilidade com a Fase 8 (crítico)
A camada de autoria **compila** para a MESMA `structure` (jsonb) que o motor de provisionamento da Fase 8 já lê. O contrato não mudou; `program_templates.structure` passou a ser **espelho da versão publicada**. Provisionamento existente segue idêntico.

## Critérios de aceite
| # | Critério | Status |
|---|---|---|
| 1 | Fase 8 intacta (contrato `structure` inalterado; tenants antigos não mudam ao publicar) | ✅ |
| 2 | Composição real (blueprint montado de blocos e publicado v1) | ✅ compile.ts + publishTemplateVersion |
| 3 | Versionamento (publicar não altera tenants provisionados; versão registrada) | ✅ `tenant_provisioning.template_version` |
| 4 | Recomendação (deal de saúde → template de saúde; fallback por regra) | ✅ recommend.ts no wizard |
| 5 | Degradação graciosa (sem agente/versão → fallback; build passa) | ✅ |
| 6 | Auditoria & RLS (autoria admin-only; 52/52) | ✅ |
| 7 | Uso real (tenant de blueprint setorial recém-composto) | ✅ **validado ao vivo** |

### Prova do critério 7
Provisionei *Clínica Piloto Saúde DEMO* pelo blueprint **Saúde/Imago**. No banco: frentes com **Atendimento**, entregáveis **"Agente WhatsApp 24h de triagem e agendamento"** + **"Intake de documentos por IA (laudos/pedidos)"** + CRM de pacientes + dashboard clínico, **3 fases**, provisionamento `pronto / v1`. Nasceu com as frentes, agentes e tom do setor de saúde.

## O que foi construído
- **Migration 015** (renumerada de 012): `template_verticals`, `template_blocks`, `template_versions`; estende `program_templates` (+`vertical_key`, +`current_version`) e `tenant_provisioning` (+`template_version`). Autoria admin-only.
- **Compile & versão** (`lib/templates/compile.ts`): `compileStructure(blocks, tomDaVertical)` → structure única; `publishTemplateVersion(templateKey, blocos, changelog)` compila → grava versão publicável → atualiza `current_version` + espelha structure. Só uma versão publicada por vez.
- **Pinagem** (Fase 8): o provisionamento registra `template_version` usada; publicar v2 não mexe em tenants antigos.
- **Recomendação** (`lib/templates/recommend.ts`): mapa setor→vertical por regra (saúde/leilão/varejo/PME) a partir da indústria do prospect ligado ao deal; superfície no **wizard** (template pré-selecionado + justificativa).
- **Verticais (4):** Leilão&Arte, Saúde&Diagnóstico, Varejo, PME genérico — com tom setorial e agentes padrão.
- **Blocos (13):** agentes (WhatsApp 24h, intake docs, BI, jurídico, comercial, social), frentes e biblioteca — genéricos e setoriais.
- **Blueprints v1 publicados (4):** ART MG (migrado da Fase 8 para versionado), **Imago (3 fases)**, Varejo, PME.
- **Admin** `/admin/biblioteca-templates`: blueprints por vertical com prévia da structure, compor & publicar de blocos, duplicar-e-adaptar, histórico de versões, CRUD de blocos.

## Notas honestas
- Os blueprints foram **semeados como structures compiladas** (v1 publicada) + os blocos existem para o compositor; publicar novas versões pelo admin usa o `compileStructure` real (provado pelo fluxo de publicação).
- Recomendação usa **fallback por regra** (a camada de agentes refina no futuro; sem agente já funciona).
- Dois tenants de teste (Piloto ART MG DEMO, Clínica Piloto Saúde DEMO) ficaram como sandbox — reverter na Central de Onboarding.
- Gotcha de automação (herdado da F8): submit de server-action via `form.requestSubmit()`.
