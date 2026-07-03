# AI OS · Relatório da Fase 2 — Motor Comercial

**Status: implementada, build verde, RLS 12/12, deploy de produção no ar.**
URL: **https://ai-os-sable.vercel.app** · Propostas em `/admin/propostas` · Portal público em `/p/{token}`.

> Numeração: a migração desta fase é a **004** (`004_propostas_whatsapp.sql`) porque a `003` já existia (Fase 1.6). Há também a **005** (`005_fix_lock_trigger.sql`) — correção de um bug latente descrito abaixo.

## O que foi construído
- **Migration 004:** `proposals` ganhou `access_token` (link público), `valid_until`, `timeline`, `roi_note`, `conditions_md`, `client_name/email`. Novas tabelas `proposal_events` (leitura/decisões, admin-only) e `wa_messages` (adapter, admin-only).
- **Adapter WhatsApp (Bloco 1):** interface neutra `CanalWhatsApp` (`lib/whatsapp/types.ts`), implementação **Z-API** (`zapi.ts`) gravando `wa_messages`, factory por `WHATSAPP_PROVIDER` (pronta p/ `meta_cloud`), `notifyAdmin()`, `sendToContact()` com **opt-in obrigatório** (bloqueio auditado), webhook `POST /api/whatsapp/webhook?key=…` (status + inbound → `activities`). **Modo degradado**: sem envs, loga e segue — nunca quebra o fluxo.
- **Gerador (Bloco 2):** `/admin/propostas` (lista + filtros por status + última leitura), builder `/admin/propostas/nova` e edição de rascunho com **preview ao vivo**, picker do catálogo (alerta âmbar em `needs_review`), **colunas duplas AK × ST + total**, editor de **timeline**, bloco de **Plano de Plataforma** + linha destacada **"Plataforma AI OS"** (mensalidade), parcelas com simulador, condições com cláusula padrão. `ProposalDocument` é o documento visual (capa serif, tabela dupla, timeline horizontal, navy/gold) usado no preview e na página pública. Sidebar ganhou **Propostas**; o deal tem atalho **"Gerar proposta"**.
- **Portal público (Bloco 3):** `/p/[token]` (fora do guard), busca por token via **service role**; token inválido/expirado → "Proposta indisponível". Primeira abertura grava `viewed` (com IP), muda `enviada→em_leitura` e notifica o admin. **Analytics de leitura por seção** (IntersectionObserver + `sendBeacon` a cada 5s → `/api/p/[token]/track`). **Barra de decisão** com 3 modais: **Aprovar** (nome+cargo+checkbox → `content_hash` = sha256 do HTML no mesmo update que trava a linha; deal → fechamento), **Solicitar ajuste** e **Recusar** (deal → perdido). Analytics no admin em `/admin/propostas/[id]` (preview + status/versões + eventos + leitura por seção + decisor + hash). "Gerar nova versão" clona com `version+1`.
- **Bloco 4:** `docs/HUBSPOT_DESLIGAMENTO.md`.

## Bug encontrado e corrigido (migration 005)
A trigger `fn_lock_approved` (da migração 000) comparava `old.status = 'assinado'` — mas em `proposals` o `old.status` é o enum `proposal_status`, e `'assinado'` pertence a `contract_status`. O Postgres tentava coagir o literal e falhava com *"invalid input value for enum proposal_status: assinado"* em **todo UPDATE de proposals**. Nunca disparou antes porque nada atualizava propostas até a Fase 2. Corrigido com `old.status::text` e, de quebra, o `return new` no DELETE (que cancelava todos os deletes) virou `return old`.

## Roteiro de teste ponta a ponta (manual, após login)
1. **Criar:** CRM → abra um deal → **Gerar proposta**. No builder: título, itens de **duas marcas** (AK + ST), timeline com 2–3 fases, mensalidade AI OS, condições. Veja as **colunas AK × ST** e o total no preview → **Criar rascunho**.
2. **Enviar:** na proposta (rascunho) → **Enviar proposta**. Status vira *enviada*, o deal vai para *proposta*, o admin é notificado por WhatsApp (se Z-API configurada) e o link é gerado.
3. **Abrir como cliente:** copie o **link público** e abra em aba anônima / celular. Deve abrir **sem login**. O admin recebe "cliente abriu a proposta". Role as seções — a leitura por seção é registrada.
4. **Aprovar:** na barra inferior → **Aprovar** → nome + cargo + "Li e aprovo". A página passa a mostrar "Proposta aprovada…" e **bloqueia nova decisão**.
5. **Verificar trava e hash:** no admin `/admin/propostas/[id]` confira `content_hash` preenchido, decisor e a **leitura por seção** (segundos). O deal moveu para **fechamento**. Editar uma proposta aprovada retorna **erro do banco** (imutável).
6. **Nova versão:** em uma proposta com *ajuste solicitado* (ou qualquer não-rascunho) → **Gerar nova versão** → abre a v2 em rascunho, com as versões linkadas.

## Verificações automatizadas
- **build** verde · **`npm run test:rls` 12/12** (inclui: anônimo não lê `proposals` nem `proposal_events`; cliente de outra org não lê `proposal_events`).
- **e2e de banco (service role):** fluxo criar→enviar→ver→aprovar 7/7 — `content_hash` gravado no mesmo update, deal→fechamento, e **update em proposta aprovada é bloqueado pela trava**.

## Configuração para produção
- **`NEXT_PUBLIC_SITE_URL`** setado na Vercel para os links públicos ficarem absolutos.
- **WhatsApp (opcional):** para ativar, configure na Vercel `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `WHATSAPP_WEBHOOK_KEY`, `ADMIN_WHATSAPP_NUMBERS` (e aponte o webhook da Z-API para `/api/whatsapp/webhook?key=SEU_SEGREDO`). Sem isso, tudo funciona em **modo degradado** (notificações apenas logadas).
- **Redirect URLs do Supabase** (magic link / recuperação) continuam pendentes de allowlist, como nas fases anteriores.

## Pendências / ressalvas
- **Lighthouse ≥ 85 na página pública:** não medido aqui (sem a ferramenta no ambiente); a `/p/[token]` é leve (sem recharts). Se necessário, ajuste numa iteração.
- **Teste com clique** nas telas autenticadas não roda no preview do Claude (iframe bloqueia o cookie de sessão) — validado por build, RLS e e2e de banco.

## Fora de escopo (próximas fases)
Contratos/Docusign/Stripe (F3) · Portal autenticado do cliente, MCP, Playbook (F4) · Consultor WhatsApp bidirecional (F5) · Meta Cloud API (F6 — adapter já pronto).
