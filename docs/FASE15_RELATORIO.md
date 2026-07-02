# AI OS · Relatório da Fase 1.5 — Admin Avançado

**Status: implementada, build verde, suíte RLS 9/9, deploy de produção no ar.**
URL de produção: **https://ai-os-sable.vercel.app** (domínio próprio `ai-os.salestrack.com.br` pendente do registro DNS `A → 76.76.21.21`).

---

## O que foi construído (por bloco)

### Bloco 0 · Migration 002 (aplicada via MCP)
`deals`: `last_activity_at`, `next_step`, `expected_close`. `catalog_items`: `frentes[]`, `internal_notes`. Nova tabela `signal_definitions` (RLS admin-only) com 8 sinais-seed. Trigger `trg_touch_deal`: toda `activity` de um deal atualiza `last_activity_at`. **Verificado:** 8 sinais, 3+2 colunas, trigger ativo.

### Bloco 1 · CRM Avançado
- **Kanban drag & drop** (`@dnd-kit`) — arrastar entre colunas muda o estágio (optimistic + `moveDealToStage` + audit + activity). Card mostra dias sem atividade (**≥14 = borda âmbar + tag “estagnado”**), valor, próximo passo. Barra de filtros: busca, marca, ICP, score mínimo; **totais por coluna** (qtd + soma R$). Zona “Perdido” tracejada: arrastar abre **modal com motivo obrigatório**.
- **Detalhe `/admin/crm/[id]`** — cabeçalho editável (título, estágio, marca, ICP, valor, fechamento previsto, próximo passo). **Protocolo de Sinais** (checkboxes → grava `deals.signals` e **recalcula score = soma dos pesos**; “Abordar agora” em teal quando ≥20). **Timeline** de `activities` + nota rápida. **Contatos** da conta (vincular/desvincular principal). **Converter em cliente** (cria org onboarding se não houver) e **marcar perdido**.
- **Contas** `/admin/crm/contas` (lista orgs não-Salestrack, nº de deals, CRUD + detalhe com deals e contatos). **Contatos** `/admin/crm/contatos` (busca, drawer CRUD, badge opt-in WhatsApp). **Import** reescrito com **dedupe por e-mail** (atualiza) e **por título+org** para deals (re-import não duplica); cria/vincula org pela coluna Company. Sub-nav: Pipeline · Contas · Contatos · Importar.

### Bloco 2 · Dashboard Executivo
Cards: Pipeline total · **Pipeline ponderado** (valor × prob. por estágio 5/15/30/50/75%) · Deals ativos · Catálogo a revisar. **4 gráficos recharts** (funil qtd, funil valor, deals/semana×12, valor por ICP + split AK×ST) no tema navy/gold. **3 Ações do Dia** (score≥20 → abordar; estagnado≥14d → retomar; preços a revisar), cada uma com link. **Feed** mesclado de `activities` + `audit_logs` (autor por e-mail). **Filtro por marca** (AK/ST/todas).

### Bloco 3 · Catálogo Avançado
Colunas **Custo · Margem R$ · Margem %** (margem negativa em vermelho suave) + chips de frentes. Busca + **ordenação clicável** (nome/preço/margem). **Ações em lote** (ativar/desativar/marcar revisado, auditadas). **Duplicar** item ((cópia), needs_review=true). **Export CSV** filtrado (`/admin/catalogo/export`). Form com **frentes** (multi-select com sugestões) e **notas internas**. **Histórico** por item (audit_logs do item, autor + diff resumido).

### Bloco 4 · Configurações & Segurança
- **Equipe** `/admin/configuracoes/equipe`: lista membros (e-mail, papel, **MFA ativo?**, desde). **Convite por e-mail** (service role → `inviteUserByEmail` + membership). Alterar papel / remover (não a si mesmo). Tudo auditado.
- **Enforcement de MFA**: middleware — admin Salestrack sem sessão **AAL2** é barrado. Com fator → desafio `/login/mfa`. Sem fator → forçado a `/admin/configuracoes` (única rota liberada) para cadastrar. **Sem risco de lockout** (Configurações é sempre acessível).
- **Auditoria** `/admin/configuracoes/auditoria`: tabela paginada com filtros (ação/recurso/período), drawer com payload JSON, e **“Verificar integridade da cadeia”** (percorre em ordem e confere `prev_hash → hash`; retorna ✓ íntegra ou ✗ com o id da quebra).
- **Sinais** `/admin/configuracoes/sinais`: CRUD dos pesos do método (auditado).

---

## Como testar cada critério de aceite

1. **Kanban dnd / estagnação / perda** — CRM → arraste um card entre colunas (persiste + timeline “estágio”). Cards ≥14 dias sem atividade ficam âmbar/“estagnado”. Arraste um card para a faixa **Perdido** → o modal exige motivo.
2. **Detalhe / sinais / timeline** — abra um deal → marque sinais (o **score recalcula** na hora; ≥20 mostra “Abordar agora”) → escreva uma nota (aparece na timeline).
3. **Contas/Contatos/import dedupe** — importe um CSV do HubSpot em Importar; **importe o mesmo arquivo de novo** → contatos/deals **não duplicam** (contadores mostram “atualizados”). Veja Contas/Contatos populados.
4. **Dashboard** — veja os 4 cards (incl. ponderado), 4 gráficos, 3 Ações do Dia (clicáveis) e o feed. Alterne o filtro AK/ST.
5. **Catálogo** — colunas de margem; ordene por margem; selecione linhas e use ações em lote; **Duplicar**; **Exportar CSV**; abra um item e veja o **Histórico**.
6. **Equipe / MFA / cadeia** — em Equipe, convide um e-mail e mude papel. **MFA:** como admin sem fator você é levado a Configurações → ative o MFA (QR) → o painel libera; ao relogar, o app pede o código em `/login/mfa`. Em Auditoria, clique **Verificar integridade da cadeia** → deve retornar **✓ íntegra**.

---

## Pendências e observações conscientes
- **⚠️ MFA agora é obrigatório para admin.** No seu próximo acesso ao `/admin`, você será direcionado a **Configurações** para cadastrar o MFA (app autenticador). Enquanto não cadastrar, o restante do painel fica bloqueado — é o comportamento pedido. A tela de Configurações (senha + MFA) permanece sempre acessível, então **não há risco de travar a conta**.
- **E-mails de convite / recuperação de senha / link mágico** dependem de allowlist no Supabase: **Authentication → URL Configuration** → Site URL `https://ai-os-sable.vercel.app` (depois o domínio próprio) e Redirect URLs `https://ai-os-sable.vercel.app/**` (e `https://ai-os.salestrack.com.br/**`). Sem isso, os links por e-mail caem no Site URL padrão.
- **Verificação da cadeia** confere o encadeamento `prev_hash → hash` (detecta remoção/reordenação/inserção). O recomputo total do SHA-256 do payload é atrelado ao `now()` do instante do insert (usado pela trigger), por isso a verificação robusta e determinística é a de encadeamento.
- **Lighthouse ≥ 85:** não medido neste ambiente (sem Lighthouse aqui). O dashboard carrega o recharts (~109 kB de JS extra); se a nota ficar abaixo de 85, dá para code-split/lazy-load os gráficos numa iteração rápida.
- **Teste E2E autenticado com clique** não foi possível pelo preview do Claude (renderiza em iframe e o cookie de sessão `SameSite=Lax` é bloqueado). A verificação foi feita por: build verde, **RLS 9/9**, testes de lógica direto no Supabase, e smoke tests HTTP em produção (públicas 200, `/admin/*` protegidas 307→login).
- **GitHub:** o deploy foi por **Vercel CLI** (upload direto). O repositório `salestrackapp/ai-os` está na Fase 1; os commits da Fase 1.5 estão locais. Posso sincronizar o GitHub se você fornecer um token com `Contents: write`.

## Fora de escopo (mantido para as próximas fases)
Gerador de propostas / portal de aprovação (F2), Stripe/Docusign (F3), portal do cliente / MCP / Playbook (F4), Z-API/WhatsApp (F2), white-label N2/N3 (F6).
