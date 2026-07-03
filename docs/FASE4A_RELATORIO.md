# AI OS · Relatório da Fase 4a — Portal do Cliente

**Status: implementada, build verde, RLS 23/23, deploy no ar.** URL: **https://ai-os-sable.vercel.app**

> Decisão de arquitetura respeitada: **o AI OS não se conecta a nenhum sistema do cliente**. Não há servidor MCP, conector, tokens de integração nem Open API para clientes nesta fase. O uso de IA do cliente acontece 100% no ambiente dele; o AI OS é a base de transformação e o canal de entrega. As tabelas `connector_tokens`/`claude_workspaces` de fases anteriores não foram expostas (apenas ignoradas).
>
> Numeração: migração **008** (`008_portal_cliente.sql`) + `008b` (correção de policy) — as 004–007 já existiam.

## O que foi construído
- **Migration 008:** papéis `client_admin`/`client_member` no enum, tabela `invites` (RLS admin + client_admin), `projects.activated_at/activated_by`, `portal_access_log` (admin-only), bucket `biblioteca`. **As policies de leitura-tenant do cliente já existiam desde a migração 000** (auditadas via pg_policies).
- **Auth por papel (Bloco 1):** login → `/entrar` resolve por papel (admin → `/admin`; cliente → `/portal`; sem membership → `/sem-acesso`). Middleware protege `/admin` e `/portal`. Admin layout redireciona clientes para o portal.
- **Convites:** `createClientInvite` (admin na tela do programa **e** client_admin no portal) → `invites` + e-mail (Resend) com link `/convite/[token]`. Aceite: cria conta (senha), cria `membership` com o papel, marca `accepted_at`, loga e entra no portal. Convite expirado/usado → mensagem clara; reenvio na lista. A página de aceite só revela **nome da org + quem convidou**.
- **Ativação do programa:** no **primeiro acesso** de qualquer membro ao portal, `projects.status onboarding → ativo` (`activated_by='primeiro_acesso'`) + audit + WhatsApp + e-mail ao admin. **Ativação/pausa manual** no admin (`activated_by='admin'`).
- **Portal `/portal` (Bloco 2):** layout próprio com **branding N1 do tenant** (logo + cor de acento de `tenant_branding`, fallback AI OS). Módulos:
  - **C1 Meu Programa:** hero (nome/status/fase), barra de progresso, timeline das fases (herdada da proposta via project), entregáveis com status, próxima sessão, saldo de créditos de sessão.
  - **C6 Biblioteca:** grid de `library_assets` da org + repositório-mestre; busca + filtro por tipo; download via **URL assinada (1h)** do bucket `biblioteca`.
  - **C7 Equipe:** membros da org; `client_admin` convida/remove e vê convites pendentes; `client_member` só visualiza.
  - **C10 Financeiro:** somente leitura — faturas da org + mensalidade AI OS ativa (com link de pagamento quando houver).
- **Admin — entrega (Bloco 3):** `/admin/programas` (lista + card **Programas ativos** + último acesso do cliente) e `/admin/programas/[id]` (status ativar/pausar, checklist do kickoff, **upload/gestão da biblioteca da org**, **convidar equipe do cliente**). Item **Programas** na sidebar.

## Segurança (Bloco 4)
- **RLS 23/23.** Isolamento por tenant provado com 2 clientes/2 orgs em: projects, deliverables, library_assets, invoices, subscriptions, session_credits, invites, memberships (cliente A não vê **nenhuma** linha da org B).
- **Bug de RLS encontrado e corrigido (008b):** a policy `client_admin_own_invites` só checava o papel no `USING`; o `INSERT` usa `WITH CHECK`, que só validava a org — permitindo a qualquer membro criar convites. Corrigido: `WITH CHECK` agora exige `client_admin`. O teste `client_member NÃO cria convites` cobre isso.
- **Assertivas novas:** `client_member` não cria convites; anônimo não lê invites/library_assets; cliente **não lê tabelas administrativas** (deals, catalog_items).
- URLs da Biblioteca com expiração **≤ 1h**. Página de convite não vaza dados da org.

## Roteiro de teste ponta a ponta (manual)
1. **Convidar:** admin → `/admin/programas/[id]` → "Convidar equipe do cliente" (client_admin) — o e-mail sai pelo Resend.
2. **Aceitar:** abra o link do e-mail (`/convite/[token]`) em aba anônima → crie a senha → cai no `/portal`.
3. **Ativação:** esse primeiro acesso muda o programa para **ativo** (veja em `/admin/programas` + WhatsApp/e-mail ao admin).
4. **Navegar:** C1 mostra a timeline real do projeto do kickoff (F3) + entregáveis + créditos; C6 baixa um material (upload feito no admin) via URL assinada; C10 lista as faturas (só leitura).
5. **Isolamento:** com um segundo cliente de outra org, confirme que **nada** da org alheia aparece.
6. **Papéis:** `client_admin` convida/remove; `client_member` não vê essas ações.

## Confirmação de escopo
Nenhuma rota, tela ou API de **integração com sistemas do cliente** foi criada (decisão permanente). Nada de MCP/conector/tokens/Open API.

## Pendências / ressalvas
- **Teste de clique autenticado** não roda no preview do Claude (iframe/cookie) — validado por build + **RLS 23/23** + smoke de produção.
- Envio de convite depende de `RESEND_API_KEY` (já configurado); sem ele, o convite é criado mas o e-mail fica em modo degradado.

## Fora de escopo (próximas fases)
Integração com sistemas do cliente (permanente) · Conteúdo do Playbook/trilhas/wizard (F4b) · Agendamento Calendly/Meet/Read AI (F4b) · Central de Ativação/ROI/Expandir (F5) · white-label N2/N3 e domínio próprio (F6).
