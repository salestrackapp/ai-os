-- 050 · CORREÇÃO CRÍTICA: a auditoria estava morta desde a migration 028
--
-- O que aconteceu: a 028 (endurecimento de segurança) fixou `search_path = public, pg_temp`
-- nas 7 funções SECURITY DEFINER, para impedir sequestro de função por quem consiga criar
-- objeto num schema do caminho. Correto — MAS `fn_audit_hash` chama `digest()` do pgcrypto,
-- e no Supabase o pgcrypto vive no schema `extensions`, fora daquele caminho.
--
-- Resultado: TODA inserção em audit_logs passou a falhar com
-- `function digest(text, unknown) does not exist`. E falhou em SILÊNCIO, porque `audit()` e
-- `auditService()` descartavam o retorno do insert. A trilha de auditoria — que é justamente a
-- prova anti-adulteração exigida pela LGPD — ficou parada em 2026-07-28 15:00:39.
--
-- A correção mantém o endurecimento: o caminho continua explícito e imutável, só passa a
-- incluir `extensions`. Voltar para search_path mutável reabriria o problema original.
--
-- Do lado da aplicação, lib/audit.ts passou a LOGAR o erro em vez de descartá-lo — era isso
-- que impedia qualquer um de notar. Lição: `await insert()` sem olhar o retorno é um teste
-- que sempre passa.
alter function fn_audit_hash() set search_path = public, extensions, pg_temp;

-- Autoteste: insere, confere que o hash saiu do 'pending' e remove.
do $$
declare v_id bigint; v_hash text;
begin
  insert into audit_logs (org_id, actor_id, action, resource, resource_id, payload, hash)
  values (null, null, 'audit.autoteste', 'audit_logs', null, '{"origem":"migration 050"}'::jsonb, 'pending')
  returning id, hash into v_id, v_hash;

  if v_hash is null or v_hash = 'pending' then
    raise exception 'o gatilho de hash nao sobrescreveu o pending — auditoria ainda quebrada';
  end if;

  delete from audit_logs where id = v_id;
  raise notice 'auditoria restaurada: hash gerado com % caracteres', length(v_hash);
end $$;
