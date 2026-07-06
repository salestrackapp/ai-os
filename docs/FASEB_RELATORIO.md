# Fase B · Estúdio de Entregáveis — Relatório de Aceite

**Objetivo:** tudo que a plataforma entrega passa a sair em nível executivo. Motor de produção:
dados do AI OS + template executivo → artefato profissional (PDF/PPTX/DOCX/HTML), no design system,
com marca dupla e portão de aprovação. Fronteira mantida: nada se conecta a sistema de cliente.

## Entregue

### Bloco 1 · Migration 016
- **Colisão evitada:** `deliverables` (Fase 4a) é dos entregáveis de PROGRAMA; os artefatos executivos vivem em `studio_deliverables`.
- `deliverable_templates` (global, admin), `studio_deliverables` (org), `studio_deliverable_versions` (histórico imutável, unique deliverable+version). Bucket privado `entregaveis`.
- Trigger `fn_lock_approved_deliverable`: conteúdo/título de **proposta aprovada/entregue** é imutável (só render/estado).

### Bloco 2 · Pipeline `lib/deliverables/render/`
- `html.ts` — documento **standalone** (CSS embutido, sem dependência do app), design system + fixes de print obrigatórios (`@media print` restaurando variáveis + `print-color-adjust: exact` + `break-before: page` nas seções pai).
- `pdf.ts` — Playwright/Chromium. Serverless (Vercel) via `@sparticuz/chromium`; local/self-host via Chrome do sistema. **Degradação graciosa**: sem Chromium, cai para HTML print-ready.
- `pptx.ts` — pptxgenjs 16:9 (`defineLayout` **e** `pres.layout`).
- `docx.ts` — lib `docx`.
- `index.ts` — orquestra render → upload no bucket → grava `rendered_url` + snapshot de versão. Auditado.

### Bloco 3 · Templates fundadores (7, semeados)
proposta_executiva (andre, pdf), roi_mensal (tenant, pdf), dossie_prospect (salestrack, pdf),
relatorio_frente (salestrack, pdf), resumo_sessao (andre, pdf), one_pager (salestrack, pdf),
apresentacao_exec (andre, pptx). `lib/deliverables/compose.ts` mapeia cada origem do AI OS.

### Bloco 4 · Geração assistida + portão + imutabilidade
- Rascunho assistido via `AiAssist` (copiloto Fase 5); sem agentes → composição manual.
- Portão `rascunho → em_revisao → aprovado → entregue`; só **aprovado** entrega. Transições auditadas.
- Imutabilidade de proposta aprovada aplicada no trigger (Bloco 1).

### Bloco 5 · Biblioteca + compartilhamento
- Admin **/admin/entregaveis** (+/[id]): criar/gerar, editar rascunho, revisar/aprovar, entregar, re-renderizar (nova versão), baixar (URL assinada), pré-visualização executiva no iframe.
- Portal **/portal/entregaveis**: aprovados/entregues da org, download por URL assinada (white-label).
- **/entregavel/[token]** — rota fora do guard; só o artefato do token (aprovado/entregue) via URL assinada.

### Bloco 6 · Origens ligadas
- ROI publicado → "Gerar relatório executivo" (/admin/roi).
- Proposta com org → "Gerar no Estúdio" (/admin/propostas/[id]).
- Prospect com dossiê → "Dossiê executivo" (/admin/prospeccao/[id]).

## Critérios de aceite

| # | Critério | Status |
|---|----------|--------|
| 1 | Qualidade executiva (capa, sumário, Cormorant+DM Sans+DM Mono, cores em print sem inversão, paginação) | ✅ PDF real de 4 páginas gerado do pipeline; cores corretas via `print-color-adjust:exact` |
| 2 | Marca dupla (proposta André Kachan colunas separadas; ROI white-label do tenant) | ✅ Proposta com colunas AK×ST; ROI real com branding N2 do piloto (accent `#2E9E7B`) |
| 3 | Multiformato (PDF + PPTX 16:9 sem quebra) | ✅ PDF real + PPTX real (`PK`, layout AIOS16x9 com defineLayout+pres.layout) |
| 4 | Portão & imutabilidade (só aprovado entrega; proposta aprovada travada) | ✅ Trigger rejeita edição de conteúdo em proposta entregue (erro P0001) |
| 5 | Isolamento (cliente só vê os seus; link público só o token) | ✅ RLS: cliente lê só o próprio aprovado/entregue; link resolve só o artefato do token |
| 6 | Degradação graciosa (sem agentes: rascunho manual + render; build passa) | ✅ `next build` verde; render degrada para HTML sem Chromium |
| 7 | Auditoria & RLS 100% | ✅ create/render/status/deliver em `lib/audit.ts`; **npm run test:rls 61/61** |
| 8 | Uso real: gerar+aprovar+entregar um ROI executivo e uma proposta | ✅ 2 PDFs reais entregues (ROI 99 KB white-label; Proposta 126 KB) com token público em produção |

## Uso real (critério 8) — artefatos entregues em produção
- **ROI executivo · Clínica Piloto Saúde** (white-label N2): PDF real no bucket, entregue, link público ativo.
- **Proposta · André Kachan × Salestrack** (colunas duplas): PDF real, entregue, link público ativo.
- Ambos passaram pelo portão completo (rascunho→em_revisão→aprovado→entregue) e resolvem via `/entregavel/[token]` → URL assinada do Storage.

## Observações honestas
- O PDF em produção usa `@sparticuz/chromium`; se o Chromium não subir no runtime, o artefato entregue é o **HTML print-ready** (mesmo layout, Ctrl-P do usuário gera o PDF). A prova de PDF real foi feita com o pipeline idêntico (mesmo HTML+fixes de print) via Chromium.
- Os dois artefatos de uso real foram produzidos pelo pipeline (mesma lógica de compose/html/pdf/deliver) acionado por script server-side, pois o painel admin exige clique autenticado no browser.

## Deploy
Produção: **https://ai-os-sable.vercel.app** · rotas admin-gated (307→login); `/entregavel/[token]` público.
