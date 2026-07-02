# Colocar o AI OS no ar — 3 passos (~10 min)

## Opção A · Claude Code faz tudo (recomendado)
1. Crie o projeto no [supabase.com](https://supabase.com) → nome `ai-os`, região **São Paulo (sa-east-1)**. Guarde: URL, anon key, service role key.
2. Abra o **Claude Code** na pasta deste projeto (descompactada) com os MCPs **Supabase** e **Vercel** conectados.
3. Cole o prompt de `prompts/PROMPT_DEPLOY.md`. Ele aplica as migrations, configura as variáveis, cria seu usuário admin, faz o deploy e aponta o domínio.

## Opção B · Manual
```bash
# 1. Migrations (SQL Editor do Supabase): cole e execute, nesta ordem
supabase/migrations/000_schema_aios.sql
supabase/migrations/001_seed_catalogo.sql

# 2. Variáveis: copie .env.example para .env.local e preencha

# 3. Deploy
npx vercel --prod        # e adicione o domínio ai-os.salestrack.com.br no painel
```
Depois: Authentication → Users no Supabase → **Add user** (seu e-mail + senha) → na tabela `memberships`, insira uma linha ligando seu `user_id` à org `salestrack` com role `salestrack_admin`.

## Validar segurança (obrigatório antes de usar com dados reais)
```bash
npm install
npm run test:rls   # precisa passar 100%
```
