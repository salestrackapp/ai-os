# PROMPT · Deploy do AI OS (colar no Claude Code, na pasta do projeto)

Este projeto Next.js (AI OS · Salestrack) está pronto e com build verde. Sua tarefa é apenas colocá-lo no ar:

1. **Supabase** (via MCP): no projeto `ai-os`, aplique em ordem `supabase/migrations/000_schema_aios.sql` e `001_seed_catalogo.sql`. Confirme que as tabelas e seeds existem.
2. Crie `.env.local` com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY do projeto (me peça as chaves se o MCP não expuser).
3. Crie meu usuário admin: user no Supabase Auth (me pergunte e-mail/senha), depois insira em `memberships` com `org_id` da org de slug `salestrack` e role `salestrack_admin`.
4. Rode `npm install && npm run test:rls` — **só prossiga se a suíte passar 100%**. Me mostre a saída.
5. **Vercel** (via MCP): crie o projeto a partir desta pasta (conecte ao GitHub criando o repo `ai-os` primeiro), configure as duas variáveis públicas, faça o deploy de produção e adicione o domínio `ai-os.salestrack.com.br` (me instrua o CNAME a criar no DNS).
6. Ao final, me entregue: URL de produção, confirmação da suíte RLS e o checklist de teste manual de `docs/FASE1_RELATORIO.md`.

Não altere código de produto; se algo falhar, corrija apenas configuração/infra e me explique.
