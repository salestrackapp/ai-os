-- Fase B · Estúdio de Entregáveis — motor de produção de artefatos executivos.
-- NOTA: `deliverables` (Fase 4a) já existe (entregáveis de PROGRAMA). Os artefatos executivos
-- desta fase vivem em `studio_deliverables` para NÃO colidir.

-- ── Templates executivos (global, admin Salestrack) ─────────────────────────
create table if not exists deliverable_templates (
  id           uuid primary key default gen_random_uuid(),
  key          text unique not null,
  kind         text not null check (kind in ('proposta','roi','dossie','relatorio_frente','resumo_sessao','one_pager','apresentacao')),
  name         text not null,
  brand_scope  text not null default 'salestrack' check (brand_scope in ('andre_kachan','salestrack','tenant')),
  format       text not null default 'pdf' check (format in ('pdf','pptx','docx','html')),
  layout       jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── Artefato gerado por org ─────────────────────────────────────────────────
create table if not exists studio_deliverables (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  template_key  text not null,
  kind          text not null,
  title         text not null,
  source_type   text not null default 'manual' check (source_type in ('roi_narrative','prospect','deal','project','session','manual')),
  source_id     uuid,
  content       jsonb not null default '{}'::jsonb,
  format        text not null default 'pdf',
  rendered_url  text,
  status        text not null default 'rascunho' check (status in ('rascunho','em_revisao','aprovado','entregue')),
  version       int not null default 1,
  public_token  text unique,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  delivered_at  timestamptz
);
create index if not exists idx_studio_deliverables_org on studio_deliverables(org_id, status);
create index if not exists idx_studio_deliverables_src on studio_deliverables(source_type, source_id);

-- ── Histórico imutável de versões renderizadas ──────────────────────────────
create table if not exists studio_deliverable_versions (
  id                uuid primary key default gen_random_uuid(),
  deliverable_id    uuid not null references studio_deliverables(id) on delete cascade,
  version           int not null,
  content_snapshot  jsonb not null default '{}'::jsonb,
  rendered_url      text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  unique (deliverable_id, version)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table deliverable_templates          enable row level security;
alter table studio_deliverables            enable row level security;
alter table studio_deliverable_versions    enable row level security;

-- Templates: admin Salestrack apenas
drop policy if exists dt_admin on deliverable_templates;
create policy dt_admin on deliverable_templates for all to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());

-- Artefatos: admin lê/edita tudo; org lê os SEUS aprovados/entregues
drop policy if exists sd_admin on studio_deliverables;
create policy sd_admin on studio_deliverables for all to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists sd_client_read on studio_deliverables;
create policy sd_client_read on studio_deliverables for select to authenticated
  using (org_id in (select user_org_ids()) and status in ('aprovado','entregue'));

-- Versões: admin apenas (cliente acessa o render atual via studio_deliverables.rendered_url)
drop policy if exists sdv_admin on studio_deliverable_versions;
create policy sdv_admin on studio_deliverable_versions for all to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());

-- ── Imutabilidade de proposta aprovada (só renderização pode mudar) ─────────
create or replace function fn_lock_approved_deliverable() returns trigger
language plpgsql as $$
begin
  if old.kind = 'proposta' and old.status in ('aprovado','entregue') then
    -- Permite mudar apenas render/estado/entrega; bloqueia mudança de CONTEÚDO.
    if new.content is distinct from old.content or new.title is distinct from old.title then
      raise exception 'Proposta aprovada é imutável: apenas renderização/entrega podem ser alteradas.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_lock_approved_deliverable on studio_deliverables;
create trigger trg_lock_approved_deliverable before update on studio_deliverables
  for each row execute function fn_lock_approved_deliverable();

-- ── Bucket privado para artefatos renderizados ─────────────────────────────
insert into storage.buckets (id, name, public)
  values ('entregaveis', 'entregaveis', false)
  on conflict (id) do nothing;
