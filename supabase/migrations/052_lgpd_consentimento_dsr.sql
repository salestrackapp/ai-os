-- 052 · LGPD do marketing: consentimento por finalidade, pedidos do titular e descadastro
--
-- Três coisas que a captura ativa (Bloco 1) e o disparo automatizado (Blocos 2-3) tornaram
-- obrigatórias:
--
--   consent_records    registro jurídico: QUEM consentiu, para QUAL finalidade, sob QUAL base
--                      legal, com a evidência do momento. Diferente de `comms_consent`, que é o
--                      gate operacional por canal+endereço e continua fazendo o seu papel no envio.
--                      Aqui a pergunta é "posso tratar o dado desta pessoa para marketing?";
--                      lá é "posso disparar neste endereço agora?".
--
--   dsr_requests       pedidos do titular (acesso, exclusão, portabilidade, correção, oposição)
--                      com prazo. A LGPD dá 15 dias para o pedido de acesso (art. 19, II) — o
--                      prazo é calculado pelo banco, não pela boa vontade de quem atende.
--
--   descadastro_tokens link de descadastro de uso público. Um token por endereço, reutilizável:
--                      o link no rodapé de um e-mail de janeiro tem que continuar funcionando
--                      em dezembro.
--
-- RLS: marketing é dado da própria Salestrack, não do cliente — família interna, admin apenas.
-- O descadastro público não passa por RLS: é rota anônima e usa service client, do mesmo jeito
-- que /entregavel/[token].

-- ── Consentimento por titular e finalidade ──────────────────────────────────────────────────
create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  email text,
  telefone text,
  finalidade text not null,
  estado text not null default 'concedido',
  base_legal text not null default 'consentimento',
  origem text,                                  -- ex.: "formulário salestrack.com.br"
  texto_aceite text,                            -- o que a pessoa leu ao aceitar
  ip inet,
  user_agent text,
  concedido_em timestamptz,
  revogado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cr_finalidade_check check (finalidade in
    ('marketing','prospeccao','transacional','academy','pesquisa')),
  constraint cr_estado_check check (estado in ('concedido','negado','revogado')),
  constraint cr_base_check check (base_legal in
    ('consentimento','legitimo_interesse','execucao_contrato','obrigacao_legal')),
  -- Sem titular identificável o registro não prova nada.
  constraint cr_titular_check check (email is not null or telefone is not null or contact_id is not null)
);
create index if not exists idx_cr_email on consent_records (lower(email));
create index if not exists idx_cr_contact on consent_records (contact_id);
create index if not exists idx_cr_finalidade on consent_records (finalidade, estado);

-- ── Pedidos do titular ──────────────────────────────────────────────────────────────────────
create table if not exists dsr_requests (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  status text not null default 'recebido',
  email text not null,
  nome text,
  contact_id uuid references contacts(id) on delete set null,
  detalhe text,                                 -- o que a pessoa pediu, nas palavras dela
  resposta text,                                -- o que foi feito
  inventario jsonb,                             -- o que existia sobre ela quando o pedido chegou
  recebido_em timestamptz not null default now(),
  -- Prazo do art. 19, II: 15 dias. Carimbado pelo banco no recebimento, não digitado por quem
  -- atende. Não é coluna gerada porque `timestamptz + interval '15 days'` não é imutável (o dia
  -- varia com horário de verão) — e o Postgres recusa expressão não-imutável em generated column.
  prazo_em timestamptz not null default (now() + interval '15 days'),
  concluido_em timestamptz,
  atendido_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dsr_tipo_check check (tipo in
    ('acesso','exclusao','portabilidade','correcao','oposicao','revogacao')),
  constraint dsr_status_check check (status in
    ('recebido','em_analise','concluido','recusado'))
);
create index if not exists idx_dsr_email on dsr_requests (lower(email));
create index if not exists idx_dsr_abertos on dsr_requests (prazo_em) where concluido_em is null;

-- ── Descadastro ─────────────────────────────────────────────────────────────────────────────
create table if not exists descadastro_tokens (
  token uuid primary key default gen_random_uuid(),
  canal text not null default 'email',
  endereco text not null,
  usado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint dt_canal_check check (canal in ('email','whatsapp')),
  unique (canal, endereco)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table consent_records enable row level security;
alter table dsr_requests enable row level security;
alter table descadastro_tokens enable row level security;

do $$
declare t text;
begin
  foreach t in array array['consent_records','dsr_requests','descadastro_tokens'] loop
    execute format('drop policy if exists %I_select on %I', t, t);
    execute format('drop policy if exists %I_ins on %I', t, t);
    execute format('drop policy if exists %I_upd on %I', t, t);
    execute format('drop policy if exists %I_del on %I', t, t);
    execute format('create policy %I_select on %I for select using (is_salestrack_admin())', t, t);
    execute format('create policy %I_ins on %I for insert with check (is_salestrack_admin())', t, t);
    execute format('create policy %I_upd on %I for update using (is_salestrack_admin()) with check (is_salestrack_admin())', t, t);
    execute format('create policy %I_del on %I for delete using (is_salestrack_admin())', t, t);
  end loop;
end $$;

-- ── Inventário do titular ───────────────────────────────────────────────────────────────────
-- Responde ao pedido de acesso e de portabilidade: o que existe sobre esta pessoa, e onde.
create or replace function fn_lgpd_inventario_titular(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_contatos uuid[];
  v_out jsonb;
begin
  select coalesce(array_agg(id), '{}') into v_contatos from contacts where lower(email) = v_email;

  select jsonb_build_object(
    'email', v_email,
    'contatos', (select coalesce(jsonb_agg(to_jsonb(c) - 'deleted_at'), '[]'::jsonb)
                 from contacts c where lower(c.email) = v_email),
    'negocios', (select coalesce(jsonb_agg(jsonb_build_object(
                   'titulo', d.title, 'etapa', d.stage, 'criado_em', d.created_at)), '[]'::jsonb)
                 from deals d where d.contact_id = any(v_contatos)),
    'leads_site', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
                   from site_leads s where lower(s.email) = v_email),
    'leads_andrekachan', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
                          from andrekachan_leads a where lower(a.email) = v_email),
    'prospeccao', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                   from prospects p where lower(p.email) = v_email),
    'consentimentos', (select coalesce(jsonb_agg(to_jsonb(cr)), '[]'::jsonb)
                       from consent_records cr where lower(cr.email) = v_email),
    'envios', (select coalesce(jsonb_agg(jsonb_build_object(
                 'canal', cd.canal, 'status', cd.status, 'em', cd.created_at)), '[]'::jsonb)
               from comms_delivery cd where lower(cd.destinatario) = v_email),
    'toques_campanha', (select count(*) from campaign_touches ct where ct.contact_id = any(v_contatos)),
    'gerado_em', now()
  ) into v_out;

  return v_out;
end $$;

-- Revogar de `anon` NÃO fecha nada sozinho: o grant que libera todo mundo é o de PUBLIC,
-- concedido por padrão a toda função nova. Sem esta linha, qualquer sessão autenticada chamava
-- a função por RPC. Provado pelo teste de RLS, não pela leitura do código.
revoke execute on function fn_lgpd_inventario_titular(text) from public;
-- Chamável só pelo service client, atrás da guarda de admin da tela. Devolve TUDO sobre um
-- titular a partir do e-mail: se `authenticated` pudesse chamar, qualquer cliente logado varreria
-- o CRM inteiro adivinhando endereços.
revoke execute on function fn_lgpd_inventario_titular(text) from anon, authenticated;
grant  execute on function fn_lgpd_inventario_titular(text) to service_role;

-- ── Exclusão em cascata ─────────────────────────────────────────────────────────────────────
-- Duas obrigações distintas que NÃO se anulam:
--   · direito ao esquecimento — apagar o que se tratava por consentimento (marketing, prospecção)
--   · trilha de auditoria e obrigação legal — `audit_logs` NUNCA é tocado, e o que tem sustentação
--     contratual (contrato assinado, proposta emitida, certificado emitido) é ANONIMIZADO, não
--     apagado: a LGPD ressalva a retenção para cumprimento de obrigação legal e exercício de
--     direitos (art. 16, I e III). Apagar um contrato assinado seria destruir prova, não proteger
--     um titular.
create or replace function fn_lgpd_excluir_titular(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_contatos uuid[];
  v_prospects uuid[];
  v jsonb := '{}'::jsonb;
  n int;
begin
  if v_email is null or v_email = '' then
    raise exception 'E-mail do titular é obrigatório.';
  end if;

  select coalesce(array_agg(id), '{}') into v_contatos  from contacts  where lower(email) = v_email;
  select coalesce(array_agg(id), '{}') into v_prospects from prospects where lower(email) = v_email;

  -- Prospecção
  delete from outreach_messages where prospect_id = any(v_prospects);
  get diagnostics n = row_count; v := v || jsonb_build_object('outreach_messages', n);
  delete from cadence_enrollments where prospect_id = any(v_prospects);
  get diagnostics n = row_count; v := v || jsonb_build_object('cadence_enrollments', n);
  delete from prospects where id = any(v_prospects);
  get diagnostics n = row_count; v := v || jsonb_build_object('prospects', n);

  -- Marketing
  delete from campaign_touches where contact_id = any(v_contatos);
  get diagnostics n = row_count; v := v || jsonb_build_object('campaign_touches', n);
  delete from site_leads where lower(email) = v_email;
  get diagnostics n = row_count; v := v || jsonb_build_object('site_leads', n);
  delete from andrekachan_leads where lower(email) = v_email;
  get diagnostics n = row_count; v := v || jsonb_build_object('andrekachan_leads', n);

  -- Comunicação
  delete from comms_consent where lower(endereco) = v_email;
  get diagnostics n = row_count; v := v || jsonb_build_object('comms_consent', n);
  update comms_delivery set destinatario = '[removido a pedido do titular]'
    where lower(destinatario) = v_email;
  get diagnostics n = row_count; v := v || jsonb_build_object('comms_delivery_anonimizados', n);
  delete from descadastro_tokens where lower(endereco) = v_email;
  get diagnostics n = row_count; v := v || jsonb_build_object('descadastro_tokens', n);

  -- CRM: o negócio some junto com o contato quando não virou contrato.
  delete from timeline_events
    where (subject_type = 'contact'  and subject_id = any(v_contatos))
       or (subject_type = 'prospect' and subject_id = any(v_prospects));
  get diagnostics n = row_count; v := v || jsonb_build_object('timeline_events', n);
  delete from contacts where id = any(v_contatos);
  get diagnostics n = row_count; v := v || jsonb_build_object('contacts', n);

  -- Retido por obrigação legal, anonimizado no que identifica
  update proposals set client_email = '[removido a pedido do titular]' where lower(client_email) = v_email;
  get diagnostics n = row_count; v := v || jsonb_build_object('propostas_anonimizadas', n);
  update contracts set signer_email = '[removido a pedido do titular]' where lower(signer_email) = v_email;
  get diagnostics n = row_count; v := v || jsonb_build_object('contratos_anonimizados', n);

  -- O consentimento em si vira prova de que houve revogação — muda de estado, não some.
  update consent_records
     set estado = 'revogado', revogado_em = now(), updated_at = now()
   where lower(email) = v_email and estado <> 'revogado';
  get diagnostics n = row_count; v := v || jsonb_build_object('consentimentos_revogados', n);

  -- audit_logs: intencionalmente intocado.
  return v || jsonb_build_object('email', v_email, 'executado_em', now());
end $$;

revoke execute on function fn_lgpd_excluir_titular(text) from public;
revoke execute on function fn_lgpd_excluir_titular(text) from anon, authenticated;
grant  execute on function fn_lgpd_excluir_titular(text) to service_role;
