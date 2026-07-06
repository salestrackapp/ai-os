# Catálogos × Ofertas — investigação e consolidação (PROMPT REV dirigido)

## Achado
**São a mesma coisa.** Tanto `/admin/ofertas` quanto `/admin/catalogo` liam a **mesma tabela `catalog_items`** — o catálogo comercial que alimenta as propostas (AI Diagnose, Sprint, engajamento, Mentoria, workshops).

| | `/admin/ofertas` (antigo) | `/admin/catalogo` (antigo) |
|---|---|---|
| Fonte | `catalog_items` | `catalog_items` (mesma) |
| UI | v5, `PageHeader` + `CrudManager` (kit R2.1) | página + `CatalogTable` + editor `/[id]`, `/novo`, filtros marca/tipo, **export CSV** |
| Nav | Comercial → "Ofertas" | Método → "Catálogo" |

## Decisão — **CONSOLIDAR** (nada apagado, reversível)
Rota canônica única: **`/admin/catalogo` = "Catálogo de ofertas"**.

**Por que Catálogo como canônico:** é o **superconjunto de funcionalidades** — filtros por marca/tipo, editor dedicado (`/[id]`, `/novo`), margens e **exportação CSV** (`/admin/catalogo/export`), que o `CrudManager` genérico de Ofertas não tinha.

**O que foi feito:**
1. `/admin/catalogo/page.tsx` — renomeado para **"Catálogo de ofertas"**, envelopado em `PageHeader` + `Breadcrumbs` (v2), moldura comercial ("alimenta as propostas · não é plano de plataforma"), filtros em chips v2, ações "Exportar CSV" + "Nova oferta".
2. `/admin/ofertas/page.tsx` — vira **redirect** `→ /admin/catalogo` (rota preservada, reversível; nada apagado).
3. **Nav** (`lib/admin/nav.ts`): a entrada de Comercial passou a "**Catálogo de ofertas**" apontando para `/admin/catalogo`; a entrada duplicada em **Método → "Catálogo"** foi **removida** (comentada). `areaForPath("/admin/catalogo")` agora resolve **Comercial** (era Método).
4. Propostas (`/admin/propostas/nova`, `/[id]`) já consomem `catalog_items` na **camada de dados** — nada muda no fluxo; continuam alimentadas pela mesma fonte.

## Reversível
- `git revert` dos 3 arquivos restaura o estado anterior.
- Nenhuma tabela/linha apagada; a rota `/admin/ofertas` continua existindo (redireciona).
- O editor e o export de Catálogo permanecem intactos.

## Resultado
Uma única "Catálogo de ofertas" comercial, sem duplicação de função, na área correta (Comercial), alimentando as propostas — e **sem** "mensalidade/plano de plataforma" (modelo PROMPT REV).
