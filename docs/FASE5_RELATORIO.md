# AI OS · Fase 5 — Evoluir (parte 1): O Consultor do Programa

**Status:** ✅ construído e em produção · `next build` verde · **33/33** testes RLS
**Deploy:** https://ai-os-sable.vercel.app
**Ativação:** o Consultor e o Agente de Sucesso funcionam com `ANTHROPIC_API_KEY` (chave da Salestrack, só no servidor). Sem ela, tudo roda em **modo degradado** sem quebrar.

## Confirmação da decisão de arquitetura
O AI OS **não se conecta a nenhum sistema do cliente**. Os agentes leem **apenas dados internos do AI OS** — `projects`/`deliverables`, `library_assets`, `playbook_recipes`, `sessions`, `session_credits` e `memories (scope='client')` — sempre filtrados por `org_id`. Não há acesso a Gmail, Drive, CRM ou qualquer ferramenta do cliente. WhatsApp e Slack aqui são canais **da Salestrack** falando com o cliente. A chave Anthropic vive só no servidor (route handlers), nunca chega ao browser.

## O que foi construído

### Infra (Blocos 1–2)
- **`lib/agents/runner.ts`** — `runAgent({agentKey, orgId, userMessages, extraContext})`: carrega o system prompt ativo de `agent_prompts`, injeta **guardrails imutáveis** (escopo, não-invenção, isolamento) + contexto, chama a API Anthropic (`ANTHROPIC_MODEL`, default `claude-sonnet-5`) e registra tokens. Degrada sem a chave.
- **`lib/agents/context.ts`** — `buildClientContext(orgId, pergunta)`: monta contexto enxuto só de fontes internas (programa/fase, entregáveis, biblioteca, próxima/última sessão, créditos, Receitas relevantes por palavra-chave, memórias). `saveClientMemory()` grava resumo `scope='client'` (auditado).
- **Nota de embeddings:** a Anthropic não tem endpoint de embeddings e a decisão é ficar só na chave Anthropic; então o RAG recupera por **fontes estruturadas + memórias recentes/por palavra-chave** (sem similaridade vetorial). A coluna `memories.embedding` fica nula — pronta para reforço futuro.
- **`lib/agents/channel.ts`** — `runConsultorTurn()` (núcleo comum aos canais): rate limit por org (20/min), resolução/continuidade de conversa, **histórico POR ORG** (continuidade entre canais), execução e persistência.

### Consultor no portal (Bloco 3) — `/portal/consultor`
Chat com branding do tenant, histórico de `conversations`/`messages`, sugestões iniciais que puxam do contexto real. Endpoint `POST /api/consultor` (auth por org, rate limit). Link no menu do portal e **card no C1 (Meu Programa)**.

### Omnichannel (Bloco 4)
- **WhatsApp:** o webhook da Fase 2 agora, ao receber inbound de um contato **identificado de uma org e com opt-in**, chama o Consultor (canal `whatsapp`) e responde pelo adapter. Continuidade com o portal (histórico por org). Desconhecido/sem opt-in → não responde (respeita a regra de opt-in).
- **Slack:** `POST /api/slack/events` — verifica assinatura (HMAC v0, anti-replay), trata `url_verification`, ignora retries. Menção/DM → resolve a org pelo mapa `app_settings.slack_channels` → Consultor (canal `slack`) → resposta no thread. Sem `SLACK_*`, inativo.

### Agente de Sucesso — ROI (Bloco 5)
- **`lib/agents/roi.ts`** — `collectRoiMetrics(org, mês)` calcula só de fontes internas: adoção do Playbook (receitas concluídas no mês, por trilha e usuários ativos), sessões realizadas + saldo de créditos, entregáveis concluídos vs total, fase/progresso. `generateRoiReport()` gera a narrativa com o Agente de Sucesso e grava em `roi_reports` (publicado=false), idempotente por (org, período).
- **Admin `/admin/roi`** — seletor de mês, "Gerar todos ativos" (job) e por cliente, revisão da narrativa e **publicar** (só então o cliente vê). Auditado.
- **Portal C8 `/portal/roi`** — relatórios **publicados** da própria org, métricas + narrativa por mês (somente leitura).

### Cockpit admin (Bloco 6)
- **`/admin/consultor`** — lista de conversas por org (canal, última mensagem, contagem) e **`/admin/consultor/[id]`** com a thread e a opção de **assumir e responder manualmente** (mensagem marcada `autor='humano'`; entregue no WhatsApp/Slack quando o canal está configurado).
- **Estúdio do Método** — editor de **prompts dos agentes** versionados (nova versão, ativar/desativar, nº de conversas por agente).
- **Dashboard** — cards "Conversas (7 dias)" e "ROI a publicar".

### Segurança (Bloco 7)
- Migration **010** com RLS: `agent_prompts` só admin; `conversations`/`messages` isoladas por org; `roi_reports` — cliente lê só **publicado** da própria org, admin tudo.
- **Rate limit** por org no núcleo do Consultor (todos os canais). Webhooks validam origem (WhatsApp `?key=`, Slack assinatura HMAC).
- **`tests/rls.test.ts` ampliado → 33/33:** A não lê `conversations`/`messages`/`roi_reports` de B; cliente não vê ROI rascunho nem da própria org; `agent_prompts` só admin; anon não lê nada; cliente não escreve conversa em outra org.
- Isolamento de contexto: `buildClientContext` e todas as queries dos agentes filtram por `org_id` — nunca trazem dados de outra org.

## Roteiro de verificação ponta a ponta
1. **Conversar no portal:** entre no portal → *Consultor* → pergunte "resuma meu programa". A resposta usa fase, próxima sessão e Receitas reais do seu programa. *(requer `ANTHROPIC_API_KEY`)*
2. **Continuar no WhatsApp:** com Z-API + opt-in do contato, mande uma mensagem; a resposta continua o mesmo histórico da org (sem repetir contexto).
3. **Gerar e publicar ROI:** admin → *ROI / Sucesso* → "Gerar todos ativos" → revise a narrativa → **Publicar**. O cliente vê em *Portal → ROI do Programa*.
4. **Isolamento:** provado por `npm run test:rls` (33/33) — dois tenants, sem vazamento de conversas/mensagens/ROI.

## Estado / pendências
- **Ativar os agentes:** setar `ANTHROPIC_API_KEY` (e opcional `ANTHROPIC_MODEL`) na Vercel Production → redeploy. Até lá, o Consultor responde "temporariamente indisponível" e o ROI gera métricas sem narrativa.
- **Slack (opcional):** `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` + mapear canais em `app_settings.slack_channels` ({channel_id: org_id}).
- **Fora de escopo (próximas fases):** prospecção/timeline comercial e MailerLite (5.5), Agente de Expansão/upsell (F6), white-label N2/N3 e Meta Cloud API (F6).
