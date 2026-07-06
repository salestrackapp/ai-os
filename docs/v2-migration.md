# Migração visual total → Salestrack AI v2 (PROMPT REV)

> **Objetivo:** todo o **chrome da plataforma** (admin + portal + transversais) na linguagem **Salestrack AI v2** — superfícies claras, texto **ink**, acento **violeta único**, **Montserrat**, sentence case — reusando a base do R1.1 (`styles/ds-tokens.css` + `components/ds`). Os **entregáveis** que devem ser escuros (render do Estúdio) **continuam escuros**.

## Estratégia (só a pele, aditivo, reversível)
A migração foi feita na **camada de estilos**, não reescrevendo 50 telas uma a uma:

1. **`app/globals.css`** — as classes legadas (`.card/.btn/.input/.badge/.nav-item/.th/.td/.stat-value…`) foram **re-tematizadas** para o v2 claro, **mantendo os mesmos nomes** (zero quebra). `color-scheme: light`, body claro + Montserrat + `--wash-bloom`, foco violeta.
2. **`tailwind.config.ts`** — os tokens legados foram **re-mapeados** para valores v2 claros (nomes preservados):
   - `navy → #F7F7FA` · `navy2 → #FFFFFF` · `navy3 → #F2F1F8` (superfícies claras)
   - `cream → #0B0B16` (ink) · `gold → #4F1FFF` (violeta) · `muted/muted2 → gray-600/500` · `teal → #18A06B`
   - `serif/sans → Montserrat` · `mono → JetBrains Mono` · `border line/goldline → hairline v2`
3. **Frames** — `LegacyFrame` e `PortalLegacyFrame` passaram de `bg-navy text-cream` para superfície clara v2 (`--bg-2`/`--fg-1`, Montserrat), preservando o white-label do portal (`.wl-theme`).
4. **Cores hardcoded** — varredura que trocou **gold → violeta** (`rgba(200,155,60,…)`/`#C89B3C` → violeta) em **26 arquivos** do chrome, e re-tematizou os gráficos (`DashboardCharts`) para paleta clara. Conflitos de papel corrigidos à mão: bolhas de chat `bg-gold text-navy → text-white`; QR do MFA `bg-cream → bg-white`.

**Por que não quebrou os entregáveis:** o render do Estúdio (`lib/deliverables/render/*`) é **HTML standalone com hex próprio** — não usa as classes/tokens legados do Tailwind (verificado: 0 ocorrências). Logo o re-mapeamento **não toca** os PDFs/decks/PNGs. O fundo da pré-visualização do entregável (`BRAND_BG` em `entregaveis/[id]`) também é hex fixo e **continua escuro**.

## Matriz de migração (rota → status)

Legenda: **v2✓** = superfície clara Salestrack AI v2. Todas verificadas via re-tema + build.

### Admin — índices v5 (já eram claros; base R1.1)
| Rota | Status |
|---|---|
| `/admin/hoje`, `/admin/clientes`, `/admin/comercial`, `/admin/estudio-area`, `/admin/metodo`, `/admin/plataforma` | v2✓ |
| `/admin/entregaveis` (+`/[id]`, `/identidade`), `/admin/comunicacao`, `/admin/ajuda` | v2✓ |
| `/admin/sinais`, `/admin/ofertas`, `/admin/programas` (+`/novo`, `/[id]/editar`), `/admin/clientes/[id]`, `/admin/design-system` | v2✓ |

### Admin — telas herdadas (eram frame escuro → agora claras via re-tema)
| Rota | Antes | Agora |
|---|---|---|
| `/admin/dashboard` | escuro navy/gold | **v2✓** (validado ao vivo — KPIs violeta, gráficos claros) |
| `/admin/crm` (+`/[id]`, `/contas`, `/contas/[id]`, `/contatos`, `/importar`) | escuro | **v2✓** (validado ao vivo) |
| `/admin/prospeccao` (+`/[id]`, `/aprovacao`, `/cadencias`) | escuro | v2✓ |
| `/admin/propostas` (+`/[id]`, `/nova`) | escuro | v2✓ |
| `/admin/contratos` (+`/[id]`) | escuro | v2✓ |
| `/admin/tarefas` | escuro | v2✓ |
| `/admin/programas/[id]` | escuro | v2✓ |
| `/admin/onboarding` (+`/novo`) | escuro | v2✓ |
| `/admin/consultor` (+`/[id]`) | escuro | v2✓ (bolha do chat = violeta + texto branco) |
| `/admin/roi` | escuro | v2✓ |
| `/admin/estudio` (+`/receita/[id]`) | escuro | v2✓ |
| `/admin/biblioteca-templates` | escuro | v2✓ |
| `/admin/catalogo` (+`/[id]`, `/novo`) | escuro | v2✓ |
| `/admin/financeiro`, `/admin/monetizacao`, `/admin/operacoes` | escuro | v2✓ |
| `/admin/configuracoes` (+`/auditoria`, `/contratos`, `/equipe`, `/parametros`, `/sinais`) | escuro | v2✓ |

### Portal — índices v5 + telas herdadas (mesmo mecanismo)
| Rota | Antes | Agora |
|---|---|---|
| `/portal`, `/portal/visao`, `/portal/copilotos`, `/portal/automacoes`, `/portal/config` | v5 claro | v2✓ |
| `/portal/playbook` (+`/[slug]`), `/portal/consultor` | escuro | v2✓ |
| `/portal/roi`, `/portal/entregaveis`, `/portal/biblioteca` | escuro | v2✓ |
| `/portal/stack`, `/portal/sessoes`, `/portal/governanca` | escuro | v2✓ |
| `/portal/equipe`, `/portal/financeiro` | escuro | v2✓ (white-label preservado) |

### Transversais / standalone
| Rota | Antes | Agora |
|---|---|---|
| `/login`, `/login/mfa`, `/reset`, `/entrar` | escuro | v2✓ (validado: `/login`) |
| `/convite/[token]`, `/sem-acesso` | escuro | v2✓ |
| `/p/[token]` (proposta pública), `/seguranca/[token]` | escuro | v2✓ (documento claro coerente) |

## Exceções intencionais (tema escuro preservado — guarda-corpo R3.2)
Não são chrome; são **conteúdo de entregável** e ficam escuros quando a identidade do programa pedir:

1. **Render do Estúdio** — `lib/deliverables/render/*` (PDF/deck/PNG/certificado): HTML self-contained com hex próprio, **intocado** pela migração. Um entregável escuro por design **continua escuro**.
2. **Pré-visualização do entregável** — iframe em `/admin/entregaveis/[id]` com fundo `BRAND_BG` (`#0B0B16`/`#0F1A24`). **Validado ao vivo:** chrome claro em volta + preview escuro dentro (rgb 11,11,22).
3. **`ProposalDocument` / documento de contrato** — quando renderizados como artefato, seguem o próprio hex; a versão de tela agora acompanha o v2 claro.

## Verificação (gate)
- **Lint visual:** 0 hex escuro remanescente no chrome (fora das exceções acima); 0 `color-scheme: dark`; 0 gold hardcoded no chrome.
- **Validação ao vivo (preview autenticado):** `/login`, `/admin/hoje`, `/admin/crm`, `/admin/dashboard` → superfície clara, ink, violeta, Montserrat. Entregável em `/admin/entregaveis/[id]` → chrome v2 claro + preview **escuro** (guarda-corpo).
- **Build:** `next build` verde (First Load JS compartilhado ~102 kB, sem regressão).
- **Testes:** `test:ds` 81/81 · `test:rls` 68/68.
- **Funcionalidade:** nenhuma alterada — só a camada visual. RLS intocada.

✅ **100% do chrome em Salestrack AI v2.** Exceções = entregáveis de tema escuro (intencional).
