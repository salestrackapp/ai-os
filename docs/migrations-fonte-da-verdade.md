# Migrations · o repositório é a fonte da verdade

Reconciliado em 2026-07-28 (Fase 1 · Bloco 1).

## O que aconteceu

O banco tinha **40 migrations aplicadas**; o repositório tinha **23 arquivos**. As 17 restantes
haviam sido aplicadas direto no Supabase (via `apply_migration` do MCP) e nunca versionadas —
o repositório não descrevia mais o schema real.

As 17 foram recuperadas na íntegra de `supabase_migrations.schema_migrations` (o Supabase guarda
o SQL aplicado) e gravadas como arquivos. Cada uma foi conferida por md5 do SQL normalizado
(sem comentários e sem espaços) contra o que está aplicado: **17/17 idênticas**.

Migrations recuperadas: `008_client_roles`, `008b_fix_invite_policy`, `016_settings_console`,
`023_formacao_certificados`, `024_video_render`, `025_comunicacao_regua`, `026_comms_canais`,
`027_comm_orquestracao`, `relacionamento_inbox_e0`, `relacionamento_e2_templates_regras`,
`relacionamento_e4_templates_canal_hsm`, `rel_mensagens_status_entrega_expand`,
`diagnostico_intake`, `create_site_leads_for_salestrack_website`, `journey_u1_foundation`,
`estudio_uc_catalogo`, `create_andrekachan_leads`.

As 23 que já existiam também foram conferidas: todas equivalentes ao aplicado. As diferenças
encontradas eram apenas comentários (o Supabase os remove ao registrar) e, em `022`, a forma
`org_id = any(user_org_ids())` no arquivo contra `org_id in (select user_org_ids())` no banco —
semanticamente equivalentes, com vantagem para a segunda forma no plano de execução.

## A regra, daqui em diante

**Toda alteração de schema entra como arquivo versionado neste diretório.** Não aplique DDL
direto pelo MCP ou pelo painel sem gravar o arquivo correspondente — foi assim que o repositório
divergiu.

Se por algum motivo uma migration for aplicada fora do fluxo, recupere-a antes de seguir:

```sql
select name, array_to_string(statements, E'\n')
from supabase_migrations.schema_migrations
where name = '<nome>';
```

Para auditar o repositório inteiro contra o banco, compare o md5 do SQL normalizado:

```sql
select name, md5(regexp_replace(
    regexp_replace(array_to_string(statements, E'\n'), '--[^\n]*', '', 'g'),
    '\s+', '', 'g')) as norm_md5
from supabase_migrations.schema_migrations order by version;
```

e, localmente, `perl -0777 -pe 's/--[^\n]*//g; s/\s+//g' <arquivo>.sql | md5 -q`.

## Convenções

- Nome: `NNN_snake_case_pt.sql`, sequencial, numeração nunca reutilizada. **Próximo número: `028_`.**
- Sempre aditivo e idempotente: `create table if not exists`, `add column if not exists`,
  `drop policy if exists` antes de `create policy`. Nenhum `drop` destrutivo — não há migration de volta.
- Sem `create type ... as enum` novo. Desde a `001` a casa usa `text` + `constraint <prefixo>_<nome>_check`,
  que permite ampliar o vocabulário depois com `drop constraint` / `add constraint`.
- Toda tabela nova precisa da própria RLS **na mesma migration**. O laço `DO` de `000_schema_aios.sql`
  foi bootstrap único das 35 tabelas daquela versão e **não cobre tabelas novas**.
