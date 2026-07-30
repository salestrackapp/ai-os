-- R3.5 · Certificados emitidos (auditável, reemissão versionada). O agregado de formação vive
-- em studio_deliverables (line = tipo, content = currículo/teste). Aditivo/reversível.
create table if not exists formacao_certificados (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  deliverable_id uuid references studio_deliverables(id),   -- a formação de origem
  participante_nome text not null,
  participante_email text,
  formacao_titulo text not null,
  carga_horaria text,
  brand_attribution text not null default 'salestrack',
  nota int,                                                 -- nota do teste, se houver
  version int not null default 1,
  rendered_url text,                                        -- PDF no bucket
  emitido_por uuid,
  emitido_em timestamptz not null default now(),
  deleted_at timestamptz,
  constraint fc_attr_check check (brand_attribution in ('salestrack','andre_kachan'))
);
create index if not exists idx_fc_org on formacao_certificados (org_id);
create index if not exists idx_fc_deliverable on formacao_certificados (deliverable_id);
create index if not exists idx_fc_alive on formacao_certificados (deleted_at) where deleted_at is null;

alter table formacao_certificados enable row level security;
drop policy if exists fc_admin on formacao_certificados;
create policy fc_admin on formacao_certificados for all using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists fc_client_read on formacao_certificados;
create policy fc_client_read on formacao_certificados for select using (org_id in (select user_org_ids()));
