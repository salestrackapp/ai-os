# QA Visual — Coerência do design Salestrack AI v2 (R5.3)

> **Objetivo:** provar que todo o app e toda entrega falam **uma só língua visual — Salestrack AI v2**. A marca (Salestrack, André Kachan, tenant) é apenas **assinatura/atribuição** no ativo, nunca um segundo design.

## Método
1. `grep` por hex hardcoded, classes de tema legado e famílias de fonte fora do sistema de tokens nas páginas `page.tsx` das superfícies v5 (admin + portal).
2. Inspeção dos _chromes_ que decidem qual moldura cada rota recebe (`AdminChrome`, `PortalChrome`) e do allowlist `isV5Path`.
3. Conferência dos renders de entregável (documento/deck/formação/e-mail/mensagem/arte/vídeo) — todos derivam de **um** `theme(accent)`.

## Achados

### ✅ Páginas v5 são 100% baseadas em tokens
As telas v5 (cockpit Hoje, 5 áreas admin, Estúdio, Comunicação, Identidade, e as telas v5 do portal) usam exclusivamente:
- Tokens de cor (`var(--brand)`, `var(--accent)`, `var(--fg-1..4)`, `var(--bg-1..2)`, `--tile`, `--hairline`).
- Classes utilitárias `.ds-*` e o anel de foco violeta `ds-focus`.
- Fontes do sistema (Montserrat / JetBrains Mono).

Nenhum hex solto nas `page.tsx` v5 — **exceto três casos intencionais e documentados**:
- `app/admin/design-system/page.tsx` — a **página viva** do design system, que exibe a paleta; os hex ali são o _conteúdo_ (amostras de cor), não estilização de UI.
- `app/admin/contratos/[id]` e `app/admin/configuracoes/parametros` — páginas **legadas** renderizadas na moldura escura (ver abaixo).

### ✅ Coexistência aditiva (moldura legada) — decisão de projeto, não vazamento
`PortalChrome`/`AdminChrome` roteiam por `isV5Path`:
- Rota na allowlist v5 → **AppShell v5 clara**, baseada em tokens.
- Rota fora da allowlist → **`LegacyFrame`/`PortalLegacyFrame` escura** (navy/gold), preservando telas antigas ainda não migradas.

Páginas ainda na moldura legada (classes `bg-navy3`, `bg-gold`, `text-cream`, `font-serif`):
- **Portal (11 telas profundas):** playbook, playbook/[slug], roi, sessoes, entregaveis, stack, financeiro, equipe, governanca, consultor, biblioteca — e os componentes `ConsultorChat.tsx`, `NextRecipe.tsx`.
- **Admin:** contratos/[id], configuracoes/parametros (e demais telas legadas fora da allowlist).

Isto é **coexistência aditiva deliberada**, conforme o comentário em `components/portal/PortalChrome.tsx` ("AppShell v5 + sidebar de 5 áreas; páginas v5 renderizam claras, telas legadas no frame escuro"). O tema legado **não vaza** para as rotas v5 (guard-rail `tema-não-vaza` mantido) e o v5 **não invade** as telas legadas. Nenhuma tela mistura os dois. É trabalho **residual de migração**, não uma violação de marca — e não quebra nada em produção.

### ✅ Renders de entregável: um design, marca só na assinatura
Todos os renders (PDF via Playwright/Chromium, PPTX via pptxgenjs, PNG @2x) passam por **um único** `theme(accent)` em `lib/deliverables/render/html.ts`. A marca escolhida por linha (`brandDefault`) altera apenas **logo, nome e cor de acento (accent)** — nunca o layout, a tipografia ou a estrutura. Guard-rail `marca-dupla` mantido: não existe um "segundo design" por marca.
- Acentos permitidos travados por `isV2Accent()` / `V2_ACCENTS` — cores fora do conjunto v2 são rejeitadas.
- **PII só no envio, nunca gravada no ativo** — o render é impessoal por construção.

## Guard-rails visuais (status)
| Guard-rail | O que garante | Status |
|---|---|---|
| `marca-dupla` | Marca = assinatura, não um 2º design | ✅ mantido |
| `tema-não-vaza` | Tema legado não entra em rota v5 (e vice-versa) | ✅ mantido |
| `accent-v2` | Só acentos do conjunto v2 nos renders | ✅ mantido |
| `pii-no-ativo` | PII nunca gravada no entregável | ✅ mantido |

## Veredito
Coerência visual **aprovada**. As telas v5 e todas as entregas são Salestrack AI v2 puro. As telas legadas em moldura escura são coexistência aditiva planejada (migração residual), isoladas por _chrome_ — não um vazamento de design.
