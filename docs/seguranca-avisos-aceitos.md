# Segurança · avisos do linter aceitos conscientemente

Revisado em 2026-07-28 (Fase 1 · Bloco 2). Antes: **22 avisos**. Depois: **10**.

## O que foi corrigido (migrations 028 e 029)

**`search_path` mutável em 7 funções — 7 avisos → 0.** `is_salestrack_admin`, `user_org_ids`,
`fn_audit_hash`, `fn_lock_approved`, `fn_touch_deal_activity`, `fn_lock_approved_deliverable`,
`fn_lock_approved_identidade` passaram a ter `search_path = public, pg_temp`.

Era o único vetor real da lista: numa função `SECURITY DEFINER`, `search_path` mutável permite que
alguém capaz de criar objetos num schema à frente do caminho sequestre a resolução de nomes —
inclusive de `is_salestrack_admin()`, que decide quem é admin. `public, pg_temp` é seguro aqui
porque nenhum papel tem `CREATE` no schema `public` (verificado para `anon`, `authenticated` e `PUBLIC`).

**`EXECUTE` das 5 funções de gatilho revogado de `PUBLIC`.** Saíram de `/rest/v1/rpc/`.
Nota da 028→029: revogar de `anon`/`authenticated` **não funciona** — toda função nasce com
`GRANT EXECUTE TO PUBLIC`, e a revogação precisa ser de `PUBLIC`. A 028 não teve efeito; a 029 corrigiu.
Revogar é seguro porque o Postgres verifica `EXECUTE` na **criação** do trigger, não a cada disparo.

Verificação: `npm run test:rls` → **68/68 verdes** depois das duas migrations.

## Os 10 avisos que permanecem — e por quê

### `is_salestrack_admin()` e `user_org_ids()` executáveis por anon/authenticated (6 avisos)
**Mantido de propósito. Não revogue.**
Dezenas de policies se aplicam a `PUBLIC` (foram criadas sem cláusula `TO`) e chamam essas funções —
para conferir o número atual:

```sql
select count(*) from pg_policies
where schemaname='public' and roles = '{public}'
  and (coalesce(qual,'') || coalesce(with_check,'')) ~ '(is_salestrack_admin|user_org_ids)';
```

A expressão de uma policy é avaliada com os privilégios de quem consulta — revogar `EXECUTE`
transformaria "0 linhas" em `permission denied for function` para o papel `anon`, quebrando as
consultas em vez de protegê-las.

A exposição real é nula: ambas são escopadas por `auth.uid()`. Para um chamador não autenticado,
`is_salestrack_admin()` retorna `false` e `user_org_ids()` retorna conjunto vazio.

Se um dia quiser zerar este aviso, o caminho correto é **primeiro** recriar essas policies com
`to authenticated` e **depois** revogar — nessa ordem, com a suíte RLS verde entre as duas etapas.

### `rls_auto_enable()` executável por anon/authenticated (2 avisos)
**Infraestrutura do Supabase, não nossa. Não tocar.**
É uma função de *event trigger* (`returns event_trigger`) que liga RLS automaticamente em toda tabela
nova — uma rede de proteção. Não é chamável na prática: invocá-la diretamente resulta em erro, porque
funções de event trigger só executam como event trigger. Já tem `search_path = pg_catalog`.

### Extensão `vector` no schema `public` (1 aviso)
**Mantida. Movê-la quebraria o banco.**
Há **2 colunas em uso** do tipo `vector`. Mover a extensão de schema invalidaria essas colunas.
Só reconsiderar junto de uma migração planejada dessas colunas.

### `WITH CHECK (true)` em `andrekachan_leads` e `site_leads` (2 avisos)
**É o desenho pretendido** — são formulários públicos de captação; o anônimo precisa poder inserir.
Nenhuma das duas tem policy de `SELECT`, então ninguém lê os leads a não ser via `service_role`.

**Pendência real, porém:** não há limite de taxa. Hoje qualquer um pode inserir em volume e poluir a
base de leads. A correção é na aplicação, não no banco, e mora em outro repositório
(`~/andrekachan-website`, rota `src/app/api/lead/route.ts`). Fica registrado como follow-up.

### Proteção contra senha vazada desligada (1 aviso)
**Pendente — exige o painel do Supabase.** É configuração de Auth, não SQL; não dá para aplicar por
migration. Ligar em *Authentication → Policies → Leaked password protection*, que passa a checar
senhas contra o HaveIBeenPwned no cadastro e na troca.
