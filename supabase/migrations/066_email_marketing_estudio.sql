-- 066 · Estúdio de e-mail marketing
--
-- ── A restrição que desenha a ferramenta ─────────────────────────────────────────────────────
-- `fn_pode_marketing` já decide quem pode receber: nunca quem veio de coleta pública ou de
-- terceiro, e só com consentimento vigente do próprio titular. A ferramenta não contorna essa
-- função — ela a consulta no momento do envio, destinatário por destinatário. Uma lista montada
-- ontem não autoriza um envio hoje: entre as duas coisas a pessoa pode ter pedido para sair.
--
-- ── Por que uma linha por destinatário ───────────────────────────────────────────────────────
-- `email_envios` guarda um registro por pessoa, não um contador na campanha. É o que permite dizer
-- "quem recebeu, quem abriu, quem reclamou" e, principalmente, é onde mora a idempotência: a chave
-- única (campanha, e-mail) garante que reprocessar um lote não manda duas vezes para ninguém.

create table if not exists email_campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  assunto text not null default '',
  preheader text,
  blocos jsonb not null default '[]'::jsonb,
  template_slug text,
  remetente text,
  segmento jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho',
  campaign_id uuid references campaigns(id) on delete set null,
  agendada_para timestamptz,
  aprovada_por uuid references auth.users(id),
  aprovada_em timestamptz,
  enviada_em timestamptz,
  criada_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint email_campanhas_status_check
    check (status in ('rascunho','aguardando_aprovacao','aprovada','enviando','enviada','cancelada'))
);

create table if not exists email_envios (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references email_campanhas(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  email text not null,
  nome text,
  status text not null default 'pendente',
  provider_ref text,
  erro text,
  enviado_em timestamptz,
  entregue_em timestamptz,
  aberto_em timestamptz,
  clicado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint email_envios_status_check
    check (status in ('pendente','enviado','entregue','aberto','clicado','falhou','bloqueado','bounce','reclamado')),
  constraint uq_email_envios_campanha_email unique (campanha_id, email)
);

/*
 * Supressão: endereços que NUNCA mais recebem marketing.
 *
 * Separada de `consent_records` de propósito. Consentimento é o que a pessoa decidiu; supressão é o
 * que o mundo nos disse — caixa inexistente, servidor recusando, denúncia de spam. Misturar os dois
 * faria uma denúncia parecer uma revogação de consentimento, que é outro fato jurídico, e faria a
 * pessoa reaparecer na lista se algum dia consentisse de novo.
 */
create table if not exists email_supressao (
  email text primary key,
  motivo text not null,
  detalhe text,
  campanha_id uuid references email_campanhas(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint email_supressao_motivo_check check (motivo in ('bounce_duro','reclamacao','manual'))
);

create index if not exists idx_email_campanhas_status on email_campanhas (status, created_at desc) where deleted_at is null;
create index if not exists idx_email_envios_campanha on email_envios (campanha_id, status);
create index if not exists idx_email_envios_email on email_envios (lower(email));
create index if not exists idx_email_envios_provider on email_envios (provider_ref) where provider_ref is not null;

alter table email_campanhas enable row level security;
alter table email_envios enable row level security;
alter table email_supressao enable row level security;

do $$
declare t text;
begin
  foreach t in array array['email_campanhas','email_envios','email_supressao'] loop
    execute format('drop policy if exists %I_sel on %I', t, t);
    execute format('drop policy if exists %I_ins on %I', t, t);
    execute format('drop policy if exists %I_upd on %I', t, t);
    execute format('drop policy if exists %I_del on %I', t, t);
    execute format('create policy %I_sel on %I for select to authenticated using (is_salestrack_admin())', t, t);
    execute format('create policy %I_ins on %I for insert to authenticated with check (is_salestrack_admin())', t, t);
    execute format('create policy %I_upd on %I for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin())', t, t);
    execute format('create policy %I_del on %I for delete to authenticated using (is_salestrack_admin())', t, t);
  end loop;
end $$;

comment on table email_supressao is
  'Endereços que nunca mais recebem marketing por fato externo (bounce duro, reclamação). Não confundir com revogação de consentimento, que vive em consent_records.';
