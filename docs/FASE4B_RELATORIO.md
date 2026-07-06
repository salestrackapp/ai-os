# AI OS · Fase 4b — Playbook + Sessões ao Vivo

**Status:** ✅ entregue e em produção · build limpo · **28/28** testes RLS verdes
**Deploy:** https://ai-os-sable.vercel.app
**Decisão de arquitetura (mantida da 4a):** o AI OS **não se conecta a nenhum sistema do cliente**. As Receitas do Playbook são autossuficientes (o cliente executa no *seu próprio* Claude). As Sessões ao Vivo usam ferramentas de **entrega da Salestrack** (Calendly, Google Meet, Read AI) — nunca do cliente.

---

## 1. O que foi construído

### C2 · Playbook no portal do cliente
- **`/portal/playbook`** — trilhas (Claude no Dia a Dia · Playbooks de Área · Estratégia com IA), receitas em cards, barra de adoção (concluídas/total), progresso por trilha.
- **`/portal/playbook/[slug]`** — receita completa: o quê / por quê / ganho estimado, passo a passo numerado, **prompt pronto com botão “Copiar”**, e **marcar como concluída** (com feedback opcional) / desfazer.
- Progresso é registrado por org (`recipe_progress`); a visão admin (“ver como”) **não** registra conclusões.

### C4 · Sessões ao Vivo no portal
- **`/portal/sessoes`** — saldo de créditos por tipo, próximas sessões (com link da sala), **sessões realizadas com resumo + próximos passos + gravação**, e o catálogo de modalidades disponíveis (com link de agendamento quando configurado).

### Admin · Estúdio do Método
- **`/admin/estudio`** — editor de **Receitas** (CRUD completo, publicar/despublicar, excluir, marcar “a revisar”), gestão de **Trilhas** e do **Catálogo de Sessões** (marca AK/ST, modalidade, duração, Calendly, publicação).
- **`/admin/estudio/receita/[id]`** — formulário de edição/criação de receita (passos = uma linha cada; prompt pronto; perfil/nível/frente/tempo/trilha/ordem).
- **Programa (`/admin/programas/[id]`)** ganhou o painel **“Sessões ao Vivo & créditos”**: conceder créditos, **agendar sessão manual**, e **fechar sessão** (resumo + gravação) — fallback do Read AI, que debita 1 crédito.
- **Dashboard** ganhou 4 métricas do Método: receitas publicadas, receitas concluídas (adoção), sessões realizadas, saldo de sessões (todos os clientes).

### Ciclo Calendly → Google Meet → Read AI (modo degradado)
- **`POST /api/calendly/webhook?token=…`** — `invitee.created` → resolve a org pelo e-mail do participante e cria a sessão `agendada` (com sala e `calendly_ref`). Sem `CALENDLY_WEBHOOK_TOKEN`: responde `{ok:false, degraded:true}` sem falhar.
- **`POST /api/readai/webhook?token=…`** — relatório pós-reunião → localiza a sessão (por `meet_link` ou `readai_ref`), grava **resumo, gravação e action items**, marca `realizada` e **debita 1 crédito**. Sem `READAI_WEBHOOK_TOKEN`: degradado.
- Enquanto os tokens não são configurados, **todo o ciclo funciona manualmente** pelo Estúdio/Programa.

---

## 2. Banco — Migration `009_playbook_sessoes.sql`

⚠️ **Desvio consciente do SQL do prompt** (que criava `sessions`/`session_credits`/`playbook_recipes`/`recipe_progress` do zero): essas tabelas **já existiam da Fase 1 (migração 000)** com schema incompatível, e `session_credits`/`sessions` são usadas pelo **kickoff (F3)**. Para não quebrar o que já roda nem perder dados demo, a reconciliação foi:

| Tabela | Ação | Motivo |
|---|---|---|
| `playbook_trilhas` | **criada** | nova |
| `session_catalog` | **criada** | nova |
| `playbook_recipes` | **DROP + recriada** (schema F4b) | existia vazia, schema incompatível |
| `recipe_progress` | **DROP + recriada** (schema F4b) | idem (FK para recipes) |
| `sessions` | **mantida** + `add column catalog_id` | usada pelo kickoff; já tinha status/scheduled_at/meet_link/summary_md/recording_url/attendees |
| `session_credits` | **mantida como está** (`type/total/consumed/valid_until`) | usada pelo kickoff; tinha 4 linhas demo (IMAGO) — código F4b adaptado a ela |

**RLS:** leitura pública das receitas/trilhas/catálogo só quando `published` (ou admin); `recipe_progress` isolado por org (`prog_own`); `sessions`/`session_credits` mantêm as policies tenant da 000.

## 3. Seed — 20 Receitas Fundadoras
Carregadas as **20 receitas oficiais** (arquivo `AI_OS_Playbook_20_Receitas.md`) em 3 trilhas: 8 operacional + 8 gestores + 4 C-level, todas publicadas e com `needs_review=true` no campo `ganho` (estimativas ilustrativas, para você revisar com dados reais). Catálogo de sessões semeado com 8 modalidades (AK: Sessão Estratégica, Sprint 30d, Mentoria Trimestral, Workshop, Palestra, Treinamento; ST: AI Academy, AI Labs) — despublicadas até você preencher os links de Calendly no Estúdio.

## 4. Verificação
- `npm run build` → ✅ compila; rotas novas presentes (`/portal/playbook`, `/portal/sessoes`, `/admin/estudio`, `/api/calendly/webhook`, `/api/readai/webhook`).
- `npm run test:rls` → ✅ **28/28** (novos: leitura de publicados, escrita de receita bloqueada p/ cliente, isolamento de `recipe_progress` e `session_credits`).
- Smoke de produção: rotas protegidas → 307 (login); webhooks → 200 degradado.

## 5. Pendências (aguardando você)
- `CALENDLY_WEBHOOK_TOKEN` + configurar webhook no Calendly (senão: agendamento manual).
- `READAI_WEBHOOK_TOKEN` + configurar no Read AI (senão: fechamento manual da sessão).
- Revisar os textos de **ganho** das 20 receitas com dados reais e despublicar/ajustar o que quiser no Estúdio.
- Preencher os **links de Calendly** no catálogo de sessões e publicá-los.
