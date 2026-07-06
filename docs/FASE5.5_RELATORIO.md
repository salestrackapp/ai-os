# AI OS · Fase 5.5 — A Espinha Comercial (pré-venda) · Relatório de Aceite

**Status:** ✅ construído e em produção · `next build` verde · **38/38** testes RLS
**Deploy:** https://ai-os-sable.vercel.app
**Ativação plena:** funciona hoje com os agentes (ANTHROPIC já configurada). Envio de e-mail, timeline Gmail/Calendar e Apollo ativam com suas envs; sem elas, tudo cai para modo manual sem quebrar.

## Fronteira de arquitetura (confirmada)
A decisão "o AI OS não se conecta a nenhum sistema do **cliente**" segue intacta. Todas as ferramentas desta fase — Apollo, Gmail, Calendar, Read AI, MailerLite, Z-API — são **contas da Salestrack, para a pré-venda da Salestrack**. Nenhum caminho novo lê ambiente de cliente. As tabelas legadas `connector_tokens`/`claude_workspaces` seguem **intocadas e não expostas**.

## Critérios de aceite

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Fronteira preservada (tudo Salestrack; legado intocado) | ✅ | Nenhum acesso a sistema de cliente; RLS admin-only; connector_tokens/claude_workspaces não tocadas |
| 2 | Gate de score (score < mínimo não entra em cadência) | ✅ | `canEnroll` bloqueia; teste RLS "gate de score"; UI da ficha mostra 🔒 e explica |
| 3 | Portão humano (nada frio sai sem aprovação) | ✅ | `prospect_writer` grava `status='rascunho'`; cadência gera rascunho, não envia; fila de aprovação; demo confirmou `rascunho` |
| 4 | Degradação graciosa (sem envs, build passa, cai p/ manual) | ✅ | Apollo→CSV/manual; Gmail ausente→rascunho/tarefa; timeline/nurture→manual; `next build` verde |
| 5 | Isolamento (só admin/operador Salestrack) | ✅ | Migration 011 RLS `is_salestrack_admin()`; testes: cliente/anon leem 0 em todas as 7 tabelas; cliente não escreve |
| 6 | RLS gate 100% | ✅ | `npm run test:rls` → **38/38** |
| 7 | Uso real (prospect ICP1 → dossiê → toque → gate/portão → timeline) | ✅* | Demo hands-off (abaixo) |

\*#7: rodei uma demo ponta a ponta com um prospect ICP1 descartável. O **envio real** de e-mail frio exige `GOOGLE_OAUTH_*` e — por ser abordagem a uma pessoa real — a sua aprovação do destinatário; o sistema corretamente **segura como rascunho** até lá.

### Demo real (agentes na API Anthropic, doutrina aplicada)
Prospect: *Helena Vasconcelos, CEO & Co-Founder, Nimbus Logística (ICP1)*, sinais: Série A, contratação de VP Comercial, expansão. **Score 92 (mín. 60) → apto.**
- **Agente de Inteligência** gerou o dossiê: contexto do papel, 3 dores por ICP (previsibilidade pós-aporte, transição de comando comercial, risco de execução na expansão) e ganchos pela dor.
- **Agente de Redação** gerou o 1º toque frio — assunto *"Crescer no novo mercado sem perder o controle do CAC"*, abrindo pela dor, **sem citar Salestrack**, **assinado André Kachan**, com **um único CTA** de agenda.
- Verificações automáticas: portão humano (`rascunho` ✅), doutrina (não cita Salestrack ✅ / assina André ✅), gate (score 45 seria bloqueado ✅), timeline (evento registrado ✅). Dados de teste apagados no fim.

## O que foi construído
- **Migration 011** (renumerada de 008): `prospect_accounts`, `prospects`, `cadences`, `cadence_enrollments`, `cadence_step_log`, `outreach_messages` e `timeline_events` (a "activities" do prompt foi renomeada para **não colidir** com a `activities` da Fase 1). RLS admin-only em todas.
- **Score de ICP** (`lib/prospecting/score.ts`): fit de cargo/senioridade + sinais + completude; `SCORE_MIN` por ICP; `canEnroll` é o portão do funil.
- **Importação:** Apollo (`lib/apollo.ts`, degradável) + colar CSV/TSV com dedup por email/apollo_id/domínio + manual.
- **3 agentes** (`lib/prospecting/agents.ts`, reusando o runner da Fase 5 via `runAgentCore` + guardrails comerciais): Inteligência (dossiê), Redação (toques, doutrina embutida), Classificação de resposta (pausa cadência). Prompts editáveis no **Estúdio do Método**.
- **Motor de cadências** (`lib/prospecting/cadence.ts`): state machine 7 toques/12 dias, cron `/api/cron/cadence` (Vercel Cron diário, `CRON_SECRET`), portão humano, saída automática por resposta.
- **Timeline unificada** (`lib/prospecting/timeline.ts` + `lib/google.ts`): ingestão Gmail + Calendar da conta Salestrack, dedup, cada fonte independente/degradável.
- **Nurture** (`lib/mailerlite.ts` `addToNurture`): aquecidos → grupo MailerLite; sem env → manual.
- **Central de Prospecção** `/admin/prospeccao`: lista+filtros, ficha 360º (dossiê/timeline/ações), fila de aprovação, editor de cadências, conversão prospect→deal. Nav admin +Prospecção.
- **Seeds:** 3 cadências fundadoras (ICP1/2/3, 7 toques/12 dias, doutrina no `modelo`) + 3 agentes.

## Pendências para ativar canais (opcionais)
- `APOLLO_API_KEY` — importação automática por ICP.
- `GOOGLE_OAUTH_*` (+ `GOOGLE_SENDER_EMAIL`) — envio de e-mail pela conta Salestrack + timeline Gmail/Calendar.
- `CRON_SECRET` — liga o cron de cadências (sem ele, use o botão "Processar cadências agora").
- `AGENDA_URL` — CTA único dos toques frios.
- `READAI_API_KEY`, `MAILERLITE_NURTURE_GROUP_ID` — Read AI na timeline / grupo de nurture dedicado.

## Fora de escopo (próximas fases)
Prospecção nativa avançada/Ramper, Agente de Expansão/upsell (F6), white-label N2/N3 e migração Meta Cloud API (F6).
